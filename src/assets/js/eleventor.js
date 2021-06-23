import http from 'https://unpkg.com/isomorphic-git@beta/http/web/index.js'

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

/* builds a list of things. Returns a UL or an OL element */
Helpers.listBuilder = function( aList, opts = {}) {
  let ordered = opts?.ordered || false
//  let mapped  = opts?.mapped || [ 'li' ];
  let node = (ordered) ? document.createElement('ol') : document.createElement('ul');

  /*
  let mapped = opts?.mapped || function( e ) {
    let li  = document.createElement('li');
    let txt = document.createTextNode( e );
    li.appendChild( txt );
    return li
  };
  */
  opts.mapped.forEach( ( nodeType, index ) => {

    let firstTime = !index;
    console.log(typeof(nodeType));
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
     
export { Editor, EventEmitter, Helpers };
