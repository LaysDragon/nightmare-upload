var debug = require('debug')('nightmare:upload');

module.exports = exports = function(Nightmare) {
  Nightmare.action('upload',
    function(ns, options, parent, win, renderer, done) {
      parent.respondTo('upload', function(selector, pathsToUpload, done) {
        parent.emit('log', 'paths', pathsToUpload);
        try {
          //attach the debugger
          //NOTE: this will fail if devtools is open
          win.webContents.debugger.attach('1.1');
        } catch (e) {
          parent.emit('log', 'problem attaching', e);
          return done(e);
        }

        win.webContents.debugger.sendCommand('DOM.getDocument', {}, function(err, domDocument) {
          win.webContents.debugger.sendCommand('DOM.querySelector', {
            nodeId: domDocument.root.nodeId,
            selector: selector
          }, function(err, queryResult) {
            //HACK: chromium errors appear to be unpopulated objects?
            if (Object.keys(err)
              .length > 0) {
              parent.emit('log', 'problem selecting', err);
              return done(err);
            }
            win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
              nodeId: queryResult.nodeId,
              files: pathsToUpload
            }, function(err, setFileResult) {
              if (Object.keys(err)
                .length > 0) {
                parent.emit('log', 'problem setting input', err);
                return done(err);
              }
              win.webContents.debugger.detach();
              done(null, pathsToUpload);
            });
          });
        });
      });
      done();
    },
    function(selector, pathsToUpload, done) {
      if(!Array.isArray(pathsToUpload)){
        pathsToUpload = [pathsToUpload];
      }
      this.child.call('upload', selector, pathsToUpload, (err, stuff) => {
        done(err, stuff);
      });
    })

  Nightmare.action('uploadInIframe',
     function(ns, options, parent, win, renderer, done) {
       function arrayContainsArray(superset, subset) {
         if (0 === subset.length || superset.length < subset.length) {
           return false
         }
         for (var i = 0; i < subset.length; i++) {
           if (superset.indexOf(subset[i]) === -1) return false
         }
         return true
       }

       function findChildWithAttributes(node, name, attributes) {
         // parent.emit('log', 'findChildWithAttributes', JSON.stringify(node),name,attributes)
         if (node.nodeName && node.nodeName === name && node.attributes && arrayContainsArray(node.attributes, attributes)) {
           return node
         }
         if (!node.children) return null
         for (let child of node.children) {
           let node = findChildWithAttributes(child, name, attributes)
           if (node !== null) {
             return node
           }
         }
         return null
       }

       parent.respondTo('uploadInIframe', function(iframeSelector, inputFilters, pathsToUpload, done) {
         parent.emit('log', 'paths', pathsToUpload);
         try {
           //attach the debugger
           //NOTE: this will fail if devtools is open
           win.webContents.debugger.attach('1.1');
         } catch (e) {
           parent.emit('log', 'problem attaching', e);
           return done(e);
         }

         win.webContents.debugger.sendCommand('DOM.getDocument', {
           pierce: true,
           integer: -1
         }, function (err, domDocument) {
           parent.emit('log', 'getDocument', JSON.stringify(domDocument))
           win.webContents.debugger.sendCommand('DOM.querySelector', {
             nodeId: domDocument.root.nodeId,
             selector: iframeSelector
           }, function (err, iframequeryResult) {
             parent.emit('log', 'querySelector #photoUploadDialog', JSON.stringify(iframequeryResult))
             win.webContents.debugger.sendCommand('DOM.describeNode', {
               nodeId: iframequeryResult.nodeId,
               pierce: true,
               depth: -1
             }, function (err, queryResult) {
               parent.emit('log', 'describeNode #photoUploadDialog', JSON.stringify(queryResult))

               let fileNodes = findChildWithAttributes(JSON.parse(JSON.stringify(queryResult.node.contentDocument)), 'INPUT', ['type', 'file'].concat(inputFilters))
               parent.emit('log', 'fileNodes', JSON.stringify(fileNodes))

               if(fileNodes === null){
                 parent.emit('log', 'cannot find fileNodes')
                 return done(new Errpr('cannot find fileNodes'));
               }

               // parent.emit('log', 'querySelector', selector, queryResult)
               win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
                 backendNodeId: fileNodes.backendNodeId,
                 files: pathsToUpload
               }, function (err, setFileResult) {
                 if (Object.keys(err)
                    .length > 0) {
                   parent.emit('log', 'problem setting input', err)
                   return done(err)
                 }
                 win.webContents.debugger.detach()
                 done(null, pathsToUpload)
               })

             })
           })
         });
       });
       done();
     },
     function(iframeSelector,inputFilters, pathsToUpload, done) {
       if(!Array.isArray(pathsToUpload)){
         pathsToUpload = [pathsToUpload];
       }
       this.child.call('uploadInIframe',iframeSelector, inputFilters, pathsToUpload, (err, stuff) => {
         done(err, stuff);
       });
     })
}
