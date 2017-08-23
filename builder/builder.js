const https = require('https')
    , gutil = require('gulp-util')
    , fs = require('fs')
    , path = require('path')
    , compareVersions = require('compare-version')

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

  gutil.log('Starting LcdnjsBuilder')
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
    
    gutil.log(that.results.length + ' libraries retrieved')
    that.build();
  }

  let files = fs.readdirSync(snippetPath)

  if(files.length) {
    
    gutil.log('Cleaning previous snippet')

    files.forEach(function(file) {
      file = path.join(snippetPath, file)
      fs.unlinkSync(file)
    })
  }

  return function(res) {
    gutil.log('Retrieving data from: ' + cdnjsApiUrl)

    res.on('data', onData)
    res.on('end', onEnd)
  };
}

LcdnjsBuilder.prototype.onError = function(err) {
  gutil.log('Error: ', err)
}

LcdnjsBuilder.prototype.build = function() {
  let that = this
    , libraries = []
    , dumps = {}
  
  gutil.log('Start building sublime snippet at: ' + snippetPath)

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
          gutil.log('Remove previous version snippet of: ' + libName)
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

    let content = gutil.template(snippetTemplate, lib)

    that.writeFile(libName, content)
    libraries.push('* ' + libName)
  })
  
  fs.writeFileSync(path.join(__dirname, '../.log'), libraries.join('\n'))

  gutil.log('Buiding latest cdnjs sublime snippet completed')

}

LcdnjsBuilder.prototype.writeFile = function(name, content) {
  let filePath = path.join(snippetPath, name + '.sublime-snippet')
    , that = this

  gutil.log('Writing file: ' + filePath)

  fs.writeFile(filePath, content, function(err) {
    if (err) return that.onError(err)
    gutil.log('Snippet for library ' + name + ' created succesfully');
  })
}

let builder = new LcdnjsBuilder()

https.get(cdnjsApiUrl, builder.onRetrieveApi())
     .on('error', builder.onError)
