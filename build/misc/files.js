
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var textFiles = ['.css', '.js', '.json', '.tmpl', '.txt', '.svg', '.html'];

var typeByExt = {
  '.js': 'script',
  '.css': 'style',
  '.tmpl': 'template',
  '.html': 'html',
  '.json': 'json',
  '.xml': 'xml',
  '.svg': 'svg',
  '.bmp': 'image',
  '.gif': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.tiff': 'image'
};

var typeNotFoundHandler = {
  '.js': function(filename){
    return '/* Javascript file ' + filename + ' not found */';
  },
  '.css': function(filename){
    return '/* CSS file ' + filename + ' not found */'
  }
};


//
// export
//

module.exports = function(flowData){
  var fileMap = {};
  var queue = [];
  var outputQueue = [];
  var options = flowData.options;
  var fconsole = flowData.console;

  //
  // file class
  //

  function File(cfg){
    for (var key in cfg)
      this[key] = cfg[key];
  };
  File.prototype = {
    get baseURI(){
      return (this.filename ? path.dirname(this.filename) + '/' : this.baseURI_ || '').replace(/\\/g, '/');
    },
    set baseURI(uri){
      if (!this.filename)
        this.baseURI_ = path.normalize(path.resolve(flowData.inputPath, uri) + '/').replace(/\\/g, '/');
    },
    get outputFilename(){
      return this.outputFilename_;
    },
    set outputFilename(filename){
      this.outputFilename_ = path.resolve(flowData.outputDir, path.normalize(filename));
    },
    get relpath(){
      return this.filename ? relpath(this.filename) : '[no filename]';
    },
    get relOutputFilename(){
      return this.outputFilename_ ? path.relative(flowData.outputDir, this.outputFilename_).replace(/\\/g, '/') : '[no output filename]';
    },
    get digest(){
      if (!this.digest_)
      {
        var hash = crypto.createHash('md5');
        hash.update(this.outputContent || this.content);
        this.digest_ = hash.digest('base64')
          // remove trailing == which always appear on md5 digest, save 2 bytes
          .replace(/=+$/, '')
          // make digest web safe
          .replace(/\//g, '_')
          .replace(/\+/g, '-');
      }

      return this.digest_;
    },
    get encoding(){
      return this.type == 'image' ? 'binary' : 'utf-8';
    }
  };

  function normpath(filename){
    return path.normalize(path.resolve(flowData.inputDir, filename)).replace(/\\/g, '/');
  }

  function getFileId(filename){
    return relpath(path.resolve(flowData.inputDir, filename));
  }

  function relpath(filename){
    return path.relative(flowData.inputDir, filename).replace(/\\/g, '/');
  }

  function mkdir(dirpath){
    dirpath = path.resolve(flowData.inputDir, dirpath);

    if (!fs.existsSync(dirpath))
    {
      fconsole.log('Create folder ' + dirpath);
      fs.mkdirSync(dirpath);  
    }
  }

  function addFile(data){
    var file;

    if (data.filename)
    {
      data.filename = normpath(data.filename);
      var filename = data.filename;
      var fileId = getFileId(filename);
      var ext = path.extname(filename);

      if (fileMap[fileId]) // ignore duplicates
      {
        fconsole.log('[ ] File `' + fileId + '` already in queue');

        return fileMap[fileId];
      }

      if (!data.type)
        data.type = typeByExt[ext] || 'unknown';

      // create file
      file = new File(data);

      // read content
      if (fs.existsSync(filename) && fs.statSync(filename).isFile())
      {
        fconsole.log('[+] ' + file.relpath + ' (' + file.type + ')');
        file.content = fs.readFileSync(filename, textFiles.indexOf(ext) != -1 ? 'utf-8' : 'binary');
      }
      else
      {
        fconsole.log('[WARN] File `' + file.relpath + '` not found');
        file.content = typeNotFoundHandler[ext] ? typeNotFoundHandler[ext](filename) : '';
      }

      fileMap[fileId] = file;
    }
    else
    {
      file = new File(data);
    }

    queue.add(file);

    return file;
  }

  function getFile(filename){
    filename = getFileId(filename);
    return fileMap[filename];
  }

  function removeFile(filename){
    filename = getFileId(filename);
    queue.remove(fileMap[filename]);
    delete fileMap[filename];
  }  

  flowData.inputFile = addFile({
    filename: flowData.inputFilename
  });

  flowData.files = {
    queue: queue,
    map: fileMap,
    add: addFile,
    get: getFile,
    remove: removeFile,
    mkdir: mkdir
  };
};