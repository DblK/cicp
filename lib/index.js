const { EventEmitter } = require('events');
const debug = require('debug')('cicp:main');
const { Proxy } = require('@dblk/yamp');
const { Util } = require('./util');

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const architect = require('architect');

/**
 * NodeJS Proxy class
 */
class CICP extends EventEmitter {
  /**
   * @constructor
   */
  constructor() {
    super();

    // Mitm Proxy
    this.mitm = new Proxy();
    this._pluginsOptions = [];
    this._initialized = false;

    // Default options
    this.options = {
      mitm: {
        port: 8080,
        sslCaDir: '.generated-certs',
        timeout: 20000,
      },
      silent: false,
      colorize: true,
      folder: 'sessions',
      plugins: 'plugins',
      order: [],
    };

    this.logger = pino({
      prettyPrint: process.env.LOGGER_PRETTY || false,
      level: process.env.LOGGER_LEVEL || 'info',
    });

    // Internal system
    this.util = new Util(this);
    debug(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
  }

  /**
   * Generate the file for loading architect
   *
   * @param {string} pluginsPath
   * @private
   */
  _generateAvailablePlugins(pluginsPath) {
    const pkg = JSON.parse(fs.readFileSync((path.join(pluginsPath, 'package.json'))));

    const plugins = Object.keys(pkg.dependencies)
      .map(name => `./node_modules/${name}`);

    // Write config file for architect
    const data = `module.exports = ${JSON.stringify(plugins)}`;
    fs.writeFileSync(path.join(pluginsPath, 'available.js'), data);
  }

  /**
   * Add initial Properties (shared with this main project)
   * @private
   */
  _setInitialProperties() {
    this.options.order.forEach((plugin) => {
      // Check presence of plugin
      if (!Object.prototype.hasOwnProperty.call(this.app.services, plugin)) {
        this.logger.warn(`Plugin '${plugin}' not found in '${this.options.plugins}' directory`);
        return;
      }

      // Execute setInitialProperties when present
      if (this.app.services[plugin].setInitialProperties !== undefined &&
        typeof this.app.services[plugin].setInitialProperties === 'function') {
        debug(`Set Initial Properties for '${plugin}'`);
        this.app.services[plugin].setInitialProperties(this);
      }
    });
  }
  /**
   * Register all function for supervision of the Mitm Proxy (plugins)
   * @private
   */
  _addHandler() {
    this.options.order.forEach((plugin) => {
      // Check presence of plugin
      if (!Object.prototype.hasOwnProperty.call(this.app.services, plugin)) {
        return;
      }

      // Add onRequest listener
      if (this.app.services[plugin].handleRequest !== undefined &&
        typeof this.app.services[plugin].handleRequest === 'function') {
        debug(`Add handleRequest for '${plugin}'`);
        this.mitm.onRequest((req, res, next) => {
          try {
            return this.app.services[plugin].handleRequest(req, res, next);
          } catch (err) {
            this.logger.error(err);
            return next(err);
          }
        });
      }
      // Add onResponse listener
      if (this.app.services[plugin].handleResponse !== undefined &&
        typeof this.app.services[plugin].handleResponse === 'function') {
        debug(`Add handleResponse for '${plugin}'`);
        this.mitm.onResponse((req, res, proxyRes, next) => {
          try {
            return this.app.services[plugin].handleResponse(req, res, proxyRes, next);
          } catch (err) {
            this.logger.error(err);
            return next(err);
          }
        });
      }
      // Add command line parameter listener
      if (this.app.services[plugin].option !== undefined &&
        typeof this.app.services[plugin].option === 'function') {
        debug(`Add option for '${plugin}'`);

        this._pluginsOptions.push(this.app.services[plugin].option());
      }
    });
  }

  /**
   * Getter for all additional options built from plugins
   *
   * @returns {Array} ??
   */
  pluginsOptions() {
    return this._pluginsOptions;
  }

  /**
   * Set options from command line execution
   *
   * @param {*} args
   */
  setOptions(args) {
    this.util.extendDeep(this.options, args);
  }

  /**
   * Initialize the plugin system
   */
  init(cb) {
    // Generate plugins available
    this._generateAvailablePlugins(path.join(process.cwd(), this.options.plugins));
    const configPath = path.join(process.cwd(), this.options.plugins, 'available.js');

    // Load plugins system
    const archiConfig = architect.loadConfig(configPath);
    architect.createApp(archiConfig, (err, app) => {
      if (err) throw err;
      debug('app ready');
      this.app = app;

      // Add additional properties
      this._setInitialProperties();

      // Add requests/responses handlers
      this._addHandler();

      this._initialized = true;

      cb();
    });
  }

  /**
   * Starts the proxy and listen to the given port
   *
   */
  listen() {
    debug('listen');

    if (!this._initialized) {
      this.init();
    }

    // Launch Mitm Proxy
    this.mitm.listen(this.options.mitm);

    if (!this.options.silent) { // FIXME: Better implement this by disabling this.logger object
      this.logger.info(`CICP listening on ${this.options.mitm.port}`);
    }

    // Memory state after everything is loaded
    debug(`Memory usage: ${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`);
  }
}

module.exports = {
  CICP,
};
