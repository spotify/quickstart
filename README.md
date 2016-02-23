# [Deprecated]

QuickStart is no longer maintained. It will still exist in npm, but no more updates will happen. We no longer use QuickStart at Spotify, and instead recommend other bundlers such as [Browserify](http://browserify.org/) or [Webpack](https://webpack.github.io/).

# [QuickStart](http://spotify.github.io/quickstart)

A CommonJS module resolver, loader and compiler for node.js and browsers.

## Features

* Runs in node.js **and browsers**.
* Supports (most) node builtins and globals.
* SpiderMonkey AST based Plugin system.
* Stylish logs.

## General Usage

### Install QuickStart globally (for the cli)

```
npm install quickstart -g
```

### Add index.html, package.json for your application

```
cd my-awesome-app
```

index.html
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Awesomeness</title>
    <script src="./quickstart.js"></script>
  </head>
  <body></body>
</html>
```

package.json
```json
{
  "name": "my-awesome-app"
}
```

### Install needed npm packages, QuickStart and plugins locally

```
npm install underscore --save
npm install quickstart some-quickstart-transform --save-dev
```

### Build a development QuickStart file.

```
quickstart --transforms some-quickstart-transform --self > quickstart.js
```

QuickStart will build a standalone QuickStart compiler (for browsers) that includes plugins.
If you want to install or remove QuickStart plugins, or change options, repeat this step.

After that, simply link `quickstart.js` in the `<head>` of a document. It will compile and load your application at runtime in the browser.

### Deploy

```
quickstart --transforms some-quickstart-transform > awesome.js
```

This will create a compiled application for deployment.

Now simply replace `quickstart.js` with `awesome.js`

```html
<script src="./awesome.js"></script>
```

## Entry Point

QuickStart always starts compiling your application from the entry point.
This value might be read from these locations in this order:

1. Manually specified `main` option (command line or node.js).
2. Resolved automatically with the built-in node-style module resolver.

## Plugin system

QuickStart has two types of plugins: transforms and parsers.

* Parser plugins transform a specific type of source code to a SpiderMonkey AST object.
* Transform plugins transform a SpiderMonkey AST object to a SpiderMonkey AST object.

## node.js interface

```js
var quickstart = require('quickstart');

// the quickstart function returns a promise.
quickstart({/* options */}).then(function(compiled) {
  var ast = compiled.ast;
  var source = compiled.source;
  var sourceMap = compiled.sourceMap;
  // print the generated JavaScript, or print / work with the abstract syntax tree, work with sourceMaps, etc.
});
```

### options

Note: options might be augmented with the parameter `--config jsonFile.json`. It defaults to quickstart.json, and will be ignored if not found.

Command line options look the same, except hyphenated.

```js
{
  runtime: 'quickstart/runtime/browser', // override the default runtime, defaults to quickstart/runtime/browser
  transforms: [], // which transforms to use, defaults to none
  parsers: {}, // which parsers to use for each file extension, defaults to none, except embedded ones such as .js and .json.
  compress: false, // optimize and mangle the ast and JavaScript output
  output: true, // generates the (compressed if {compress: true}) JavaScript output, defaults to true
  sourceMap: false, // generates the (compressed if {compress: true}) source map, defaults to false
  self: false, // compiles the QuickStart compiler instead of the current app, defaults to false
  main: false, // override the application's main, defaults to the QuickStart resolver
  warnings: true // display warning messages, defaults to true
}
```

## command line interface

```
quickstart --help
```

### options

```
--runtime runtimeModule # override the default runtime
--transforms transformModule # which transforms to use
--parsers ext=parserModule # which parsers to use
--compress # optimize and mangle the ast and JavaScript output
--output # generates the (compressed if `--compress` is set) JavaScript output, defaults to true
--source-map # generates the (compressed if `--compress` is set) source map, defaults to false
--self # compiles the QuickStart compiler instead of the current app, defaults to false
--main ./path/to/entry-point # override the application's entry point, defaults to the QuickStart resolver
--warnings # display warnings messages, defaults to true
--ast ./path/to/source.ast # writes the ast to a file or *STDOUT*, defaults to false
```

When `--output` is set to a string, it will send the JavaScript output to that file instead of STDOUT.
```
quickstart --output output.js
```

When `--source-map` is set to a string, it will send the source map output to that file instead of STDOUT.
```
quickstart --source-map output.map > output.js
```

When `--source-map` is set without a value, and `--output` is set, it will append an inline base64 encoded source map to the output.
```
quickstart --source-map > output.js
quickstart --source-map --output output.js
```

When `--source-map` is set and `--output` is unset (`--no-output`) it will write the source map to STDOUT (no value) or the file (value).
```
quickstart --no-output --source-map > output.map
quickstart --no-output --source-map output.map
```

When `--ast` is set without a value the ast is printed to STDOUT.
```
quickstart --ast > output.ast
```

This is useful, for instance, to pipe the AST to UglifyJS or any other program that accepts a SpiderMonkey AST:
```
quickstart --ast --source-map | uglifyjs --spidermonkey > out.js
```

Note: the `--source-map` option must be set if you need location information in the AST (to have UglifyJS generate a source map, for instance).
