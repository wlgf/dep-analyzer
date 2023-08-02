#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { Command, InvalidArgumentError } from 'commander'

/* Interfaces */

interface AnalyzeOption {
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
}

interface Dependencies {
  [name: string]: string
}

interface PackageJsonObj {
  name: string
  version: string
  dependencies?: Dependencies
  devDependencies?: Dependencies
}

interface Modules<T> {
  [path: string]: {
    name?: string
    version?: string
    dev?: boolean
    requiredBy: T
  }
}

/* Global Variables */

let global: {
  path: string
  options: AnalyzeOption
  modules: Modules<Set<string>>
}

/* Functions */

let debug = (...params: any[]): void => {
  global.options.debug && console.debug(...params)
}

let exit = (...params: any[]): void => {
  console.error(...params)
  process.exit(1)
}

/**
 * 整数参数处理函数，将用户输入的参数字符串转换为整数。
 * @param {string} [value] 用户输入的参数字符串。
 * @param {number} [dummyPrev] 该函数上次执行得到的返回值。该参数没有被实际使用，但该参数的存在导致不能直接使用 `parseInt(value, radix)` 作为参数处理函数。
 * @throws 当 `parseInt(value, 10)` 的结果为 `NaN` 时，抛出错误。
 */
let parseInteger = (value: string, dummyPrev: number): number => {
  let result = parseInt(value, 10)
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
let findDepPath = (name: string, path: string): string => {
  let current = () => `${path}/node_modules/${name}`
  let from = path
  while (1) {
    if (existsSync(current())) break
    if (path == global.path)
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
 * @throws 当递归深度大于 `global.options.depth` 时，抛出错误。
 */
let getDeps = async (path: string, depth: number = 1): Promise<void> => {
  if (depth > global.options.depth)
    throw new Error('error: max recursive depth reached.')

  const data = await readFile(`${path}/package.json`)
  const packageJsonObj: PackageJsonObj = JSON.parse(data.toString())

  global.modules[path].name = packageJsonObj.name
  global.modules[path].version = packageJsonObj.version

  if (packageJsonObj.dependencies !== undefined)
    for (let depName of Object.keys(packageJsonObj.dependencies)) {
      let depPath = findDepPath(depName, path)
      if (global.modules[depPath] !== undefined) {
        global.modules[depPath].dev = false
        global.modules[depPath].requiredBy.add(path)
      } else {
        global.modules[depPath] = { dev: false, requiredBy: new Set([path]) }
        await getDeps(depPath, depth + 1)
      }
    }

  if (packageJsonObj.devDependencies !== undefined && path == global.path)
    // 只有宏仓库的 devDependencies 会被安装
    for (let depName of Object.keys(packageJsonObj.devDependencies)) {
      let depPath = findDepPath(depName, path)
      if (global.modules[depPath] !== undefined) {
        global.modules[depPath].requiredBy.add(path)
      } else {
        global.modules[depPath] = { dev: true, requiredBy: new Set([path]) }
        await getDeps(depPath, depth + 1)
      }
    }
}

let analyze = async (path: string, options: AnalyzeOption) => {
  try {
    debug('path:', path)
    debug('options:', options)

    global = {
      path,
      options,
      modules: { [path]: { dev: false, requiredBy: new Set() } },
    }

    await getDeps(path)

    // 将 Set<string> 转为 Array<string>
    // 因为 JSON.stringify(new Set([1, 2, 3])) == '{}'
    let result: Modules<string[]> = {}
    const pathes = Object.keys(global.modules)
    for (let path of pathes)
      result[path] = {
        ...global.modules[path],
        requiredBy: [...global.modules[path].requiredBy],
      }

    if (options.json !== undefined) {
      let fileName = `${options.json}/dep-analyze.json`
      await writeFile(fileName, JSON.stringify(result))
      console.log(`saved in ${fileName} successfully.`)
      console.log(pathes.length - 1, 'dependencies in total.')
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
  .option('-d, --depth <n>', 'maximum recursive level', parseInteger)
  .option('-j, --json <path>', 'save result in JSON instead of display')
  .option('--debug')
  .action(analyze)

program.parse()
