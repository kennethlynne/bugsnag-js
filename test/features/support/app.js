const { join } = require('path')
const { spawn } = require('child_process')

const defaultFixturePath = join(__dirname, '../../fixtures/app')

class TestApp {
  constructor (pathToFixture = defaultFixturePath) {
    this.buildDir = pathToFixture
    this.appName = require(join(pathToFixture, 'package.json')).name
  }

  async installDeps () {
    // retry install commands to avoid intermittent failure in electron-rebuild
    await this._exec('npm', ['install'], 1)
  }

  async packageApp () {
    await this._exec('npm', ['run', 'package'])
  }

  async installBugsnag (version) {
    // can't avoid altering the test app's package.json? :(
    // https://github.com/npm/npm/issues/17927
    await this._exec('npm', ['install', `@bugsnag/electron@${version}`, '--registry', 'http://0.0.0.0:5539'], 1)
  }

  packagedPath () {
    const platform = process.platform
    const name = this.appName
    const base = join(this.buildDir, 'out', `${name}-${platform}-${process.arch}`)
    switch (platform) {
      case 'darwin':
        return join(base, `${name}.app/Contents/MacOS/${name}`)
      case 'linux':
        return join(base, name)

      default:
        throw new Error(`No packaged app path configured for ${platform}`)
    }
  }

  launchArgs () {
    switch (process.platform) {
      case 'linux':
        // required for running chromium and friends in a root-y environment
        return ['--no-sandbox']

      default:
        return []
    }
  }

  async _exec (command, args = [], retries = 0) {
    await new Promise((resolve, reject) => {
      const proc = spawn(command, args, { cwd: this.buildDir })
      // handy for debugging but otherwise annoying output
      if (process.env.VERBOSE) {
        proc.stderr.on('data', data => { console.log(`  stderr: ${data}`) })
      }
      proc.on('close', async (code) => {
        if (code !== 0) {
          if (retries > 0) {
            await this._exec(command, args, retries - 1)
            resolve()
          } else {
            reject(new Error(`Running '${command}' failed with code: ${code}`))
          }
        } else {
          resolve()
        }
      })
    })
  }
}

module.exports = { TestApp }
