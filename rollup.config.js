// @ts-check
import typescript2 from 'rollup-plugin-typescript2'
import { terser } from 'rollup-plugin-terser'

import pkg from './package.json'

/**
 * Comment with library information to be appended in the generated bundles.
 */
const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * Copyright (c) ${pkg.author.name}
 * Released under the ${pkg.license} License.
 */
`.trim()

/**
 * Creates an output options object for Rollup.js.
 * @param {import('rollup').OutputOptions} options
 * @returns {import('rollup').OutputOptions}
 */
function createOutputOptions(options) {
  return {
    banner,
    name: 'splunk-events',
    exports: 'named',
    sourcemap: true,
    plugins: [
      ...(options.plugins || []),
      /\.min\.js$/.test(options.file) && terser(),
    ],
    ...options,
  }
}

/**
 * @type {import('rollup').RollupOptions}
 */
const options = {
  input: './src/splunk-events.ts',
  output: [
    createOutputOptions({
      file: './lib/splunk-events.js',
      format: 'commonjs',
    }),
    createOutputOptions({
      file: './lib/splunk-events.min.js',
      format: 'commonjs',
    }),
    createOutputOptions({
      file: './lib/splunk-events.esm.js',
      format: 'esm',
    }),
    createOutputOptions({
      file: './lib/splunk-events.esm.min.js',
      format: 'esm',
    }),
    createOutputOptions({
      file: './lib/splunk-events.umd.js',
      format: 'umd',
      name: 'SplunkEvents',
    }),
    createOutputOptions({
      file: './lib/splunk-events.umd.min.js',
      format: 'umd',
      name: 'SplunkEvents',
    }),
  ],
  plugins: [
    typescript2({
      clean: true,
      useTsconfigDeclarationDir: true,
      tsconfig: './tsconfig.bundle.json',
    }),
  ],
}

export default options
