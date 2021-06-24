import http from 'https://unpkg.com/isomorphic-git@beta/http/web/index.js'

let Path = {};
Path.join = function() {
  return Array.from( arguments ).join("/");
}

Path.file = function( aPath ) {
  return aPath.split('/').reverse()[0]
}

Path.normalize = function (path, allowAboveRoot) {
  var res = '';
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47 /*/*/)
      break;
    else
      code = 47 /*/*/;
    if (code === 47 /*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
	// NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
	if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46 ) {
	  if (res.length > 2) {
	    var lastSlashIndex = res.lastIndexOf('/');
	    if (lastSlashIndex !== res.length - 1) {
	      if (lastSlashIndex === -1) {
		res = '';
		lastSegmentLength = 0;
	      } else {
		res = res.slice(0, lastSlashIndex);
		lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
	      }
	      lastSlash = i;
	      dots = 0;
	      continue;
	    }
	  } else if (res.length === 2 || res.length === 1) {
	    res = '';
	    lastSegmentLength = 0;
	    lastSlash = i;
	    dots = 0;
	    continue;
	  }
	}
	if (allowAboveRoot) {
	  if (res.length > 0)
	    res += '/..';
	  else
	    res = '..';
	  lastSegmentLength = 2;
	}
      } else {
	if (res.length > 0)
	  res += '/' + path.slice(lastSlash + 1, i);
	else
	  res = path.slice(lastSlash + 1, i);
	lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return "/" + res;
}

let Helpers = {};
/* fetches the property specified in the data-property attribute of the element specified
   by the data-for attribute. */
Helpers.dataFor = function( anElement ) {
    if (!anElement.hasAttribute('data-for')) {
      throw new Error(`no data-for attribute defining a selector on ${anElement.nodeName}`);
    }

    if (!anElement.hasAttribute('data-property')) {
      throw new Error(`no data-property attribute defining the property to use on ${anElement.nodeName}`);
    }

    let urlSourceProp     = anElement.getAttribute('data-property');
    let urlSourceSelector = anElement.getAttribute('data-for');
    let urlSource = document.querySelector( urlSourceSelector );
    if (!urlSource) {
      throw new Error(`could not find element ${urlSourceSelector}`);
    }

    return urlSource[ urlSourceProp ];
};

/* builds a list of things. Returns a UL or an OL element

   usage: .listBuilder( [ list, of, things, ...], {
     ordered: aBoolean, // true for an ol false for a ul
     mapped: [ 'a', (a) => { a.setAttribute('href', '#'), 'li' ]
   });

*/

Helpers.listBuilder = function( aList, opts = {}) {
  let ordered = opts?.ordered || false
  let node    = (ordered) ? document.createElement('ol') : document.createElement('ul');
  let map     = (opts.mapped)? opts.mapped : [ 'li' ];
  
  map.forEach( ( nodeType, index ) => {
    let firstTime = !index;
    if ( typeof( nodeType ) == 'string' ) {
      aList = aList.map( (listItem) => {
	if ( firstTime ) {	
	  let newElement = document.createElement( nodeType );
	  let textNode = document.createTextNode( listItem );
	  newElement.appendChild( textNode );
	  return newElement;
	} else {	
	  let newElement = document.createElement( nodeType );
	  newElement.appendChild( listItem );
	  return newElement;
	}
      });
    } else if ( typeof( nodeType ) == 'function') {
      aList.forEach( nodeType );
    }
  });

  node.append.apply(node, aList);
  return node;
}

Helpers.replace = function( aSelector, node ) {
  if ( typeof(node) == 'function' ) {
    node = node();
  }
  Helpers.clear( aSelector ).appendChild( node );
  return document.querySelector( aSelector );
}

Helpers.clear = function( aSelector ) {
  let selected = document.querySelector( aSelector );
  while (selected.firstChild) { selected.removeChild(selected.firstChild) }
  return selected;
}

class EventEmitter {
  constructor() {
    let prop = { eventTypes: [], eventHndl: {} };
    Object.defineProperty(this, "_events", {
      value: prop,
      enumerable: true,
    });
  }

  addEventType () {    
    this._events.eventTypes.push(
      Array.from( arguments ).slice(0, arguments.length)
    );
  }

  _validateEventType( type ) {
    if (!type) throw new Error(`event type undefined`);
    
    if ( this._events.eventTypes.includes( type )) {
      throw new Error(`unknown event type ${type}`);
    }
  }

  addEventListener (type, handler, opts) {
    this._validateEventType(type);
    if ( !this._events.eventHndl[ type ] ) {
      this._events.eventHndl[ type ] = [];
    }
    this._events.eventHndl[type].push( handler );
  }

  removeEventListener (type, handler, opts) {
    this._validateEventType(type);
    let pos = this._events.eventHndl[ type ].indexOf( handler );
    if (pos != -1) this._events.eventHndl[ type ].splice(pos, 1);
  }

  emit ( type, data = {} ) {
    this._validateEventType( type );
    data.target = this;
    this._events.eventHndl[ type ].forEach( (hndl) => {
      hndl.apply( this, [ data ] );
    });
  }
}

class Editor extends EventEmitter {

  constructor() {
    super()
    this.addEventType('clone', 'read', 'write', 'commit', 'change');
  }

  async clone( opts ) {
    if (opts.url) opts.fileSystem = new LightningFS( opts.url )
    let fs = this.fs = opts.fileSystem;

    let url = fs.promises?._backend?._name;

    let dir = "/";
    await git.clone({
      fs,
      http,
      dir,
      url: url,
      corsProxy: this.config?.corsProxy || 'https://cors.isomorphic-git.org', 
      force: true
    });

    this.emit("clone");
  }
}
     
export { Editor, EventEmitter, Helpers, Path };
