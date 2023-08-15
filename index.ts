#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { Command, InvalidArgumentError, Option } from 'commander'

/* Interfaces */

interface AnalyzeOptions {
  /**
   * 最大递归深度。
   */
  depth: number

  /**
   * 将分析结果保存为 JSON 文件的目标路径。
   * - 若为 `undefined`，则不保存 JSON 文件，而是在浏览器中打开分析结果。
   */
  json?: string

  /**
   * 是（`true`）否（`undefined`）输出调试信息。
   */
  debug?: true

  /**
   * 输出 JSON 文件的格式。
   */
  format: 'path' | 'name_version' | 'edge'
}

interface PackageJsonObj {
  name: string
  version: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

type Modules<T> = Record<
  string, // Path
  {
    name: string
    version: string
    dev: boolean
    requiredBy: T
    dependencies: string[]
  }
>

type ResultPath = Modules<string[]>

type ResultNameVersion = Record<
  string, // Name
  Record<
    string, // Version
    {
      dev: boolean
      dependencies: Array<{
        name: string
        version: string
        path: string
      }>
      pathes: Record<
        string, // Path
        {
          requiredBy: Array<{
            name: string
            version: string
          }>
        }
      >
    }
  >
>

interface ResultEdge {
  nodes: Array<{
    node: number
    name: string
    version: string
    dev: boolean
  }>
  edges: Array<{
    source: number
    target: number
  }>
}

type Result = ResultPath | ResultNameVersion | ResultEdge

/* Global Variables */

let global: {
  path: string
  options: AnalyzeOptions
  modules: Modules<Set<string>>
}

/* Functions */

const debug = (...params: any[]): void => {
  global.options.debug && console.debug(...params)
}

const exit = (...params: any[]): void => {
  console.error(...params)
  process.exit(1)
}

/**
 * 整数参数处理函数，将用户输入的参数字符串转换为整数。
 * @param {string} [value] 用户输入的参数字符串。
 * @param {number} [dummyPrev] 该函数上次执行得到的返回值。该参数没有被实际使用，但该参数的存在导致不能直接使用 `parseInt(value, radix)` 作为参数处理函数。
 * @throws 当 `parseInt(value, 10)` 的结果为 `NaN` 时，抛出错误。
 */
const parseInteger = (value: string, dummyPrev: number): number => {
  const result = parseInt(value, 10)
  if (isNaN(result)) throw new InvalidArgumentError('not a number.')
  return result
}

/**
 * 从指定路径开始，向上查找并返回模块的实际路径。
 * @param {string} [name] 模块名。
 * @param {string} [path] 开始查找的路径。
 * @throws 当向上查找到 `global.path` 仍未找到模块时，抛出错误。
 * @example
 * findDepPath('B', './node_modules/A')
 * // 可能返回 './node_modules/A/node_modules/B'
 * // 可能返回 './node_modules/B'
 * // 可能抛出错误
 */
const findDepPath = (name: string, path: string): string => {
  const current = (): string => `${path}/node_modules/${name}`
  const from = path
  while (true) {
    if (existsSync(current())) break
    if (path === global.path)
      throw new Error(`error: cannot find package '${name}' from ${from}.`)
    path = path.slice(0, path.lastIndexOf('/'))
  }
  debug('found:', current())
  return current()
}

/**
 * 从指定路径下的 `package.json` 中读取模块的 `name`、`version` 等信息，保存到 `global.modules[path]` 中。随后递归查找尚未查找过的的依赖项。
 *
 * 调用该函数前，须确保 `global.modules[path] !== undefined`。
 * @param {string} [path] `package.json` 所处的路径。
 * @param {number} [depth] 递归深度。
 * @param {boolean} [dev] 该模块是否属于 `devDependencies`。
 * @param {string} [from] 该模块是哪个模块的依赖。
 * @returns 当递归深度大于 `global.options.depth` 时，返回 `false`，否则返回 `true`。
 */
const getDeps = async (
  path: string,
  depth: number = 1,
  dev: boolean = false,
  from?: string
): Promise<boolean> => {
  if (depth > global.options.depth) return false

  if (global.modules[path] !== undefined) {
    global.modules[path].dev ||= dev
    if (from !== undefined) global.modules[path].requiredBy.add(from)
    return true
  }

  const data = await readFile(`${path}/package.json`)
  const packageJsonObj: PackageJsonObj = JSON.parse(data.toString())
  let result: boolean = true

  const module = (global.modules[path] = {
    name: packageJsonObj.name,
    version: packageJsonObj.version,
    dev,
    requiredBy: new Set(from === undefined ? [] : [from]),
    dependencies: new Array<string>(),
  })

  if (packageJsonObj.dependencies !== undefined)
    for (const depName of Object.keys(packageJsonObj.dependencies)) {
      const depPath = findDepPath(depName, path)
      module.dependencies.push(depPath)
      result &&= await getDeps(depPath, depth + 1, false, path)
    }

  if (packageJsonObj.devDependencies !== undefined && path === global.path)
    // 只有宏仓库的 devDependencies 会被安装
    for (const depName of Object.keys(packageJsonObj.devDependencies)) {
      const depPath = findDepPath(depName, path)
      module.dependencies.push(depPath)
      result &&= await getDeps(depPath, depth + 1, true, path)
    }

  return result
}

const getResultNameVersion = (): ResultNameVersion => {
  const result: ResultNameVersion = {}
  const pathes = Object.keys(global.modules)

  for (const path of pathes) {
    const { name, version, dev } = global.modules[path]
    result[name] ||= {}
    result[name][version] ||= {
      dev,
      dependencies: [],
      pathes: {},
    }
    result[name][version].pathes[path] ||= {
      requiredBy: [],
    }
  }

  for (const tPath of pathes) {
    const target = global.modules[tPath]
    const tName = target.name
    const tVersion = target.version

    for (const sPath of target.requiredBy) {
      const source = global.modules[sPath]
      const sName = source.name
      const sVersion = source.version

      result[sName][sVersion].dependencies.push({
        name: tName,
        version: tVersion,
        path: tPath,
      })

      result[tName][tVersion].pathes[tPath].requiredBy.push({
        name: sName,
        version: sVersion,
      })
    }
  }

  return result
}

const getResultPath = (): ResultPath => {
  const result: ResultPath = {}

  for (const path of Object.keys(global.modules))
    result[path] = {
      ...global.modules[path],
      requiredBy: [...global.modules[path].requiredBy],
    }

  return result
}

const getResultEdge = (): ResultEdge => {
  const indeces = new Map<string, number>()
  const result: ResultEdge = {
    nodes: [],
    edges: [],
  }

  for (const path of Object.keys(global.modules)) {
    const node = result.nodes.length
    const { name, version, dev } = global.modules[path]
    indeces[path] = node
    result.nodes.push({
      node,
      name,
      version,
      dev,
    })
  }

  for (const sPath of Object.keys(global.modules))
    for (const tPath of global.modules[sPath].dependencies)
      result.edges.push({
        source: indeces[sPath],
        target: indeces[tPath],
      })

  return result
}

const analyze = async (
  path: string,
  options: AnalyzeOptions
): Promise<void> => {
  try {
    global = {
      path,
      options,
      modules: {},
    }

    debug('path:', path)
    debug('options:', options)

    if (!(await getDeps(path))) console.log('max recursive depth reached.')

    let result: Result = {}
    switch (options.format) {
      case 'path':
        result = getResultPath()
        break
      case 'name_version':
        result = getResultNameVersion()
        break
      case 'edge':
        result = getResultEdge()
        break
    }

    if (options.json !== undefined) {
      const fileName = `${options.json}/dep-analyze.json`
      await writeFile(fileName, JSON.stringify(result))
      console.log(`saved in ${fileName} successfully.`)
      console.log(
        Object.keys(global.modules).length - 1,
        'dependencies in total.'
      )
    }
  } catch (err) {
    exit(err.message)
  }
}

/* CommandJS */

const program = new Command()

program
  .name('dep-analyzer')
  .description('CLI to analyze npm dependencies')
  .version('0.1.0')

program
  .command('analyze')
  .argument('[path]', 'path of package.json', '.')
  .option('-d, --depth <n>', 'maximum recursive depth', parseInteger)
  .option('-j, --json <path>', 'save result in JSON instead of display')
  .addOption(
    new Option('-f, --format <type>', 'JSON format')
      .choices(['path', 'name_version', 'edge'])
      .default('name_version')
  )
  .option('--debug')
  .action(analyze)

program.parse()
