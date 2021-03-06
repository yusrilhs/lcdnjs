const https = require('https')
    , log = require('fancy-log')
    , fs = require('fs')
    , path = require('path')
    , compareVersions = require('compare-version')
    , template = require('lodash.template')

const cdnjsApiUrl = 'https://api.cdnjs.com/libraries?fields=version'
    , snippetPath = path.join(__dirname, '../snippets')

const snippetJs = '<snippet>\n\
    <content><![CDATA[\n\
<script type="text/javascript" src="<%= latest %>"></script>\n\
]]></content>\n\
    <tabTrigger>lcjs<%= name %></tabTrigger>\n\
    <description><%= description %></description>\n\
</snippet>\n'
    , snippetCss = '<snippet>\n\
    <content><![CDATA[\n\
<link rel="stylesheet" type="text/css" href="<%= latest %>">\n\
]]></content>\n\
    <tabTrigger>lcjs<%= name %></tabTrigger>\n\
    <description><%= description %></description>\n\
</snippet>\n'

let LcdnjsBuilder = function() {
  this.results = []

  log.info('Starting LcdnjsBuilder')
}

LcdnjsBuilder.prototype.onRetrieveApi = function() {
  let that = this
    , body = ''


  function onData(chunk) {
    body += chunk
  }

  function onEnd() {
    let cdnjsResponse = JSON.parse(body)
    that.results = cdnjsResponse.results

    log.info(that.results.length + ' libraries retrieved')
    that.build();
  }

  let files = fs.readdirSync(snippetPath)

  if(files.length) {

    log.info('Cleaning previous snippet')

    files.forEach(function(file) {
      file = path.join(snippetPath, file)
      fs.unlinkSync(file)
    })
  }

  return function(res) {
    log.info('Retrieving data from: ' + cdnjsApiUrl)

    res.on('data', onData)
    res.on('end', onEnd)
  };
}

LcdnjsBuilder.prototype.onError = function(err) {
  log.error('Error: ', err)
}

LcdnjsBuilder.prototype.build = function() {
  let that = this
    , libraries = []
    , dumps = {}

  log.info('Start building sublime snippet at: ' + snippetPath)

  that.results.forEach(function(lib) {
    let libName = lib.name
    lib.file = false
    lib.description = lib.name
                         .replace(/-/g, ' ')
                         .toLowerCase()
                         .replace(/\b[a-z]/g, function(letter) {
                            return letter.toUpperCase();
                         });

    lib.name = libName.replace(/\./g, '')

    let dump = dumps[lib.name]

    if (dump) {
        if(compareVersions(dump.version, lib.version) < 0) {
          log.warning('Remove previous version snippet of: ' + libName)
          fs.unlinkSync(path.join(snippetPath, libName + '.sublime-snippet'))
        } else {
          return
        }
    }

    dumps[libName] = {
      version: lib.version
    }

    let snippetTemplate = (path.extname(lib.latest) == '.js') ?
                              snippetJs :
                              snippetCss

    let compiled = template(snippetTemplate)
    let content = compiled(lib)

    that.writeFile(libName, content)
    libraries.push('* ' + libName)
  })

  fs.writeFileSync(path.join(__dirname, '../.log'), libraries.join('\n'))

  log.info('Buiding latest cdnjs sublime snippet completed')

}

LcdnjsBuilder.prototype.writeFile = function(name, content) {
  let filePath = path.join(snippetPath, name + '.sublime-snippet')
    , that = this

  log.info('Writing file: ' + filePath)

  fs.writeFile(filePath, content, function(err) {
    if (err) return that.onError(err)
    log.info('Snippet for library ' + name + ' created succesfully');
  })
}

let builder = new LcdnjsBuilder()

https.get(cdnjsApiUrl, builder.onRetrieveApi())
     .on('error', builder.onError)
