#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { Command, InvalidArgumentError } from 'commander'
const program = new Command()

program
  .name('dep-analyzer')
  .description('CLI to analyze npm dependencies')
  .version('0.1.0')

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
  _development?: boolean
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

let debug: boolean = false
let modules: Modules<Set<string>> = {
  '.': { requiredBy: new Set() },
}

/* Functions */

/**
 * 整数参数处理函数，将用户输入的参数字符串转换为整数。
 * @param {number} [dummyPrev] 该函数上次执行得到的返回值。该参数没有被实际使用，但该参数的存在导致不能直接使用 `parseInt(value, radix)` 作为参数处理函数。
 */
let parseInteger = (value: string, dummyPrev: number): number => {
  let result = parseInt(value, 10)
  if (isNaN(result)) throw new InvalidArgumentError('Not a number.')
  return result
}

let findDepPath = (name: string, path: string): string => {
  // if (debug) console.log('finding:', name, path)
  while (!existsSync(`${path}/node_modules/${name}`))
    path = path.slice(0, path.lastIndexOf('/'))
  // if (debug) console.log('in:', `${path}/node_modules/${name}`)
  return `${path}/node_modules/${name}`
}

let getRequiredDeps = (path: string = '.'): Promise<boolean> => {
  // if (debug) console.log('current path:', path)
  return readFile(`${path}/package.json`)
    .then((data: Buffer) => {
      let packageJsonObj: PackageJsonObj = JSON.parse(data.toString())

      modules[path].name = packageJsonObj.name
      modules[path].version = packageJsonObj.version
      modules[path].dev = packageJsonObj._development ?? false
      // if (debug) console.log('package.json:', modules[path])

      let promises: Promise<boolean>[] = []
      let depNames = [
        ...Object.keys(packageJsonObj.dependencies || {}),
        ...Object.keys(path == '.' ? packageJsonObj.devDependencies || {} : {}),
      ]
      // if (debug) console.log('next:', depNames)
      for (let depName of depNames) {
        let depPath = findDepPath(depName, path)
        if (modules[depPath] !== undefined) {
          modules[depPath].requiredBy.add(path)
        } else {
          modules[depPath] = { requiredBy: new Set([path]) }
          promises.push(getRequiredDeps(depPath))
        }
      }
      return Promise.all(promises).then(() => true)
    })
    .catch((err: Error) => {
      console.error(err.message)
      process.exit(1)
    })
}

let analyze = (path: string, options: AnalyzeOption) => {
  debug = options.debug ?? false

  if (debug) console.log('path:', path)
  if (debug) console.log('options:', options)

  getRequiredDeps().then(() => {
    if (options.json !== undefined) {
      let result: Modules<string[]> = {}
      for (let path of Object.keys(modules))
        result[path] = {
          ...modules[path],
          requiredBy: [...modules[path].requiredBy],
        }
      writeFile(`${options.json}/dep-analyze.json`, JSON.stringify(result))
    }
  })
}

program
  .command('analyze')
  .argument('[path]', 'path of package.json', '.')
  .option('-d, --depth <n>', 'maximum recursive level', parseInteger)
  .option('-j, --json <path>', 'save result in JSON instead of display')
  .option('--debug')
  .action(analyze)

program.parse()
