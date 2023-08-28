# `dep-analyzer`
`dep-analyzer` is a CLI tool used to analyze the dependency relationships between npm package dependencies.

## Install
```sh
npm i dep-analyzer -g
```

## Usage
Change to the directory containing your `package.json`, and use the command

```sh
dep-analyzer analyze
```

A webpage will open displaying the dependencies of the npm package in your project. It defaults to listening on `localhost:9143`, which can be modified using the `--port` and `--host` arguments.

For more details, you can use `--help` argument.
