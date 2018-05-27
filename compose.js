var h = require('hyperscript')
var pull = require('pull-stream')
var sbot = require('./scuttlebot')
var human = require('human-time')
var id = require('./keys').id

var tools = require('./tools')

var mime = require('simple-mime')('application/octect-stream')
var split = require('split-buffer')

var route = require('./views')

function file_input (onAdded) {
  return h('label.btn', 'Upload file',
    h('input', { type: 'file', hidden: true,
    onchange: function (ev) {
      var file = ev.target.files[0]
      if (!file) return
      var reader = new FileReader()
      reader.onload = function () {
        pull(
          pull.values(split(new Buffer(reader.result), 64*1024)),
          sbot.addblob(function (err, blob) {
            if(err) return console.error(err)
            onAdded({
              link: blob,
              name: file.name,
              size: reader.result.length || reader.result.byteLength,
              type: mime(file.name)
            })
          })
        )
      }
      reader.readAsArrayBuffer(file)
    }
  }))
}

module.exports = function (opts, fallback) {
  var files = []
  var filesById = {}

  var composer = h('div.composer')
  var container = h('div.container')

  if (opts.type == 'post')
    var textarea = h('textarea.compose', {placeholder: opts.placeholder || 'Write a message'})
  else
    var textarea = h('textarea.compose', {placeholder: opts.placeholder || 'Write a message'}, fallback.messageText) 

  var cancelBtn = h('button.btn', 'Cancel', {
    onclick: function () {
      var cancel
      console.log(opts)
      if (opts.type == 'edit') {
        cancel = document.getElementById('edit:' + opts.branch.substring(0,44))
        var oldMessage = h('div.message__body', tools.markdown(fallback.messageText))
        cancel.parentNode.replaceChild(oldMessage, cancel)
        oldMessage.parentNode.appendChild(fallback.buttons)
      } else if (opts.branch) {
        //cancel reply composer 
        cancel = document.getElementById('re:' + opts.branch.substring(0,44))
        cancel.parentNode.removeChild(cancel)
      } else {
        // cancel generic composer
        cancel = document.getElementById('composer')
        cancel.parentNode.removeChild(cancel)
      }
    }

  })

  var initialButtons = h('span', 
    h('button.btn', 'Preview', {
      onclick: function () {
        if (textarea.value) {
          var msg = {}
          msg.value = {
            "author": id,
            "content": {
              "type": opts.type
            }
          }

          if (opts.root)
            msg.value.content.root = opts.root
          if (opts.original)
            msg.value.content.original = opts.original
          if (opts.updated)
            msg.value.content.updated = opts.updated

          msg.value.content.text = textarea.value
          
          if (opts.type == 'post') 
            var header = tools.header(msg)
          if (opts.type == 'update')
            var header = tools.timestamp(msg, {edited: true})
          var preview = h('div',
            header,
            h('div.message__content', tools.markdown(msg.value.content.text)),
            h('button.btn', 'Publish', {
              onclick: function () {
                if (msg.value.content) {
                  sbot.publish(msg.value.content, function (err, msg) {
                    if(err) throw err
                    console.log('Published!', msg)
                    if (opts.type == 'edit') {
                      var message = document.getElementById(opts.branch.substring(0,44))
                      fallback.messageText = msg.value.content.text
                      var editBody = h('div.message__body',
                        tools.timestamp(msg, {edited: true}),
                        h('div', tools.markdown(msg.value.content.text))
                      )
                      
                      message.replaceChild(editBody, message.childNodes[message.childNodes.length - 1])
                      editBody.parentNode.appendChild(fallback.buttons)
                    } else {
                      if (opts.branch)
                        cancel = document.getElementById('re:' + opts.branch.substring(0,44))
                      else
                        cancel = document.getElementById('composer')
                      cancel.parentNode.removeChild(cancel)  
                    }
                  })
                }
              }
            }),
            h('button.btn', 'Cancel', {
              onclick: function () {
                composer.replaceChild(container, composer.firstChild)
                container.appendChild(textarea)
                container.appendChild(initialButtons)
              }
            })
          )
          composer.replaceChild(preview, composer.firstChild)
        }
      }
    }),
    file_input(function (file) {
      files.push(file)
      filesById[file.link] = file
      var embed = file.type.indexOf('image/') === 0 ? '!' : ''
      textarea.value += embed + '['+file.name+']('+file.link+')'
    }),
    cancelBtn
  )

  composer.appendChild(container)
  container.appendChild(textarea)
  container.appendChild(initialButtons)

  return composer
} 

