const fs = require('fs');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);

const Viz = require('viz.js');
const { Module, render } = require('viz.js/full.render.js');

let viz = new Viz({ Module, render });

/**
 * Generates a graph and saves it to a file
 * @param {string} graph
 * @param {string} filePath
 * @returns {Promise<void>}
 */
const saveGraphToFile = (graph, filePath) => {
  viz
    .renderString(graph)
    .then(svgString => writeFile(filePath, svgString))
    .catch((error) => {
      viz = new Viz({ Module, render });

      // Possibly display the error
      console.error(error);
    });
};

saveGraphToFile(fs.readFileSync('./graph/cicp.txt').toString(), './graph/cicp.svg');

