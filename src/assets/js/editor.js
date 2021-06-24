import http from 'https://unpkg.com/isomorphic-git@beta/http/web/index.js'

class EventEmitter {
  constructor() {
    let prop = { eventTypes: [], eventHndl: {} };
    Object.defineProperty(this, "_events", {
      value: prop,
      enumerable: false
    });
  }

  addEventType () {
    console.log(arguments);
    this._events.eventTypes.push( Array.from( arguments ).slice(0, arguments.length) );
    console.log(this);
  }

  _validateEventType( type ) {
    if (!type) throw new Error(`event type undefined`);
    if ( this._events.eventTypes.indexOf( type ) == -1 ) {
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

class Matter {

  static hasMatter( aString ) {
    let at = aString.indexOf( Matter.delimiter );
    return (at != -1 && at == 0);
  }

  static parse( aString ) {
    let content, meta = ["", {}];
    let at = aString.indexOf( Matter.delimiter );
    if (at != -1 && at == 0) {
      // we have some front matter
      let end = aString.indexOf( Matter.delimiter, 1);
      content = aString.substring( end + Matter.delimiter.length );
      console.log("end", end, "delimiter length: ", Matter.delimiter.length);
      meta    = jsyaml.load( aString.substring( 0 + Matter.delimiter.length, end) );
    }
    return [ content, meta ];
  }
}

Matter.delimiter = "---";

class Path {
  /* this is adapted/copied from the node.js path class */
  
  constructor( aPath ) {
    this.fullpath = aPath;
  }
  
  normalize (allowAboveRoot) {
    var res = '';
    var lastSegmentLength = 0;
    var lastSlash = -1;
    var dots = 0;
    var code;
    for (var i = 0; i <= this.fullpath.length; ++i) {
      if (i < this.fullpath.length)
	code = this.fullpath.charCodeAt(i);
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
	    res += '/' + this.fullpath.slice(lastSlash + 1, i);
	  else
	    res = this.fullpath.slice(lastSlash + 1, i);
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

  asString() {
    return this.fullpath;
  }
  
  get absolute () {
    return this.fullpath.length > 0 && path.charCodeAt(0) === 47;
  }

  get file () {
    return this.fullpath.split("/")[0];
  }

  set file(aFile) {
    this.fullpath += `/${aFile}`;
  }
  
  get path () {
    let parts = this.fullpath.split("/");
    let pathpart = parts.slice(0,-1).join("/");
    return pathpart + "/";
  }
  
  get extension () {
    let [, ext] = this.fullpath.match(/\.([^\.]+)$/);
    return ext;
  }
}

class EleventyEditor extends EventEmitter {

  constructor( url, conf ) {
    super();

    let fs = this.fs = new LightningFS(url)
    
    let myconfig = {};
    Object.assign( myconfig, EleventyEditor.defaultConfig, conf );
    
    // I prefer using the Promisified version honestly
    this.pfs    = this.fs.promises
    this.repo   = url;
    this.config = myconfig;
    
    document.querySelector( myconfig.DOMConfig?.repository ).value = this.repo;

    let saveTimeout;
    this.editor.addEventListener('input', () => {
	document.querySelector('#toolbar-commit').disabled = false;
	try {
	    clearTimeout( saveTimeout );
	} finally {
	    saveTimeout = setInterval(() =>{
		console.log("Saving...");
		this.save();
		clearTimeout(saveTimeout);
	    }, 1000);
	}
    }, false);      

    this.addEventType("clone");
    this.addEventType("write");
    this.addEventType("read");
  }
 
 /*
    directory: "#listing",
    file     : "#editor",
    metadata : "#metadata",
    repository: "#repository",
  */
  
  set editor( qs ) {
    this.config.DOMConfig.file = qs;
  }
  
  get editor() {
    return document.querySelector( this.config.DOMConfig?.file );
  }

  async clone() {
    let dir = "/";
    let fs  = this.fs;
    this.clone = await git.clone({
      fs,
      http,
      dir,
      url: this.repo,
      corsProxy: this.config?.corsProxy || 'https://cors.isomorphic-git.org', 
      force: true
    });

    console.log( this.clone );
  }

  async display() {
    let [,path] = (window.location.hash || "#/").match(/\#(.+)$/); // always trim the top of the hash
    let dirent = await this.pfs.stat(path); 
    if ( dirent?.type == 'file' ) {
      await this.drawFile( path );
    } else if ( dirent?.type == 'dir' ) {
      await this.drawDirectory( path );
    } else {
      throw new Error(`unknown file type ${dirent?.type}`);
    }
  }

  async save() {
    let [,path] = (window.location.hash || "#/").match(/\#(.+)$/); // always trim the top of the hash      
    let dirent = await this.pfs.stat(path); 
    if ( dirent?.type == 'file' ) {
	await this.writeFile( path );
	console.log('saved');
    } else if ( dirent?.type == 'dir' ) {
	console.log("cannot save directories yet");
    }
  }
    
  async writeFile( aFile ) {
      let p = new Path( aFile );
      
    let metadata = JSON.parse( document.querySelector( this.config.DOMConfig.metadata + ' textarea').value );
    let content  = document.querySelector( this.config.DOMConfig.file ).innerHTML;  
    let fdata = this.config.handlers[p.extension]?.write( content, metadata );
    await this.pfs.writeFile(aFile, fdata, { encoding: "utf8" });
    this.emit("write");
  }
    
  async drawFile( aFile ) {
    this.clearFileContents();

    let elem = document.querySelector( this.config.DOMConfig.file );
   
    let p = new Path( aFile );
    this.drawDirectory(p.path);
    
    let fdata = await this.pfs.readFile(aFile, { encoding: "utf8" });
    
    let [content, metadata] = [ "", {} ];
    if (Matter.hasMatter(fdata)) {
      console.log("there is front matter");
      [ content, metadata ] = Matter.parse( fdata );
    } else {
      console.log("there is no front matter");
      content = fdata;
    }
    
    this.drawMetadata( metadata );

    let handler = this.config.handlers[p.extension]?.read;
    if ( handler ) {
      console.log(`got a handler for ${p.extension}`);
      elem.innerHTML = handler( content );
    } else {
      console.log(`no handler for ${p.extension}`);
      elem.innerHTML = content;
    }
  }

  async drawDirectory( aPath = "/" ) {
    let list = await this.pfs.readdir(aPath);

    this.clearDirectoryListing();
    this.clearFileContents();
    
    let ul = document.createElement('ul');
    
    let pfs = this.pfs;
    let addEntry = async function( entry ) {
      let fullpath = [aPath, entry].join("");
      let dirent   = await pfs.stat(fullpath);
      
      let li  = document.createElement('li');
      let a   = document.createElement('a');
      
      let txt = document.createTextNode( entry );	
      a.appendChild(txt);
      
      let newpath = new Path(fullpath);
      if ( dirent?.type == 'dir' ) {
	newpath = newpath.normalize() + "/";
      } else newpath = newpath.normalize();
      
      a.setAttribute('href', "/#" + newpath);
      
      li.appendChild(a);
      ul.appendChild(li);
    }
    
    try {
      addEntry("..");
    } catch(e){
      console.log("couldn't add .. to the list of files. We're probably the root");
    }
    list.forEach( addEntry );
    
    document.querySelector( this.config.DOMConfig.directory ).appendChild(ul);    
  }
  
  drawMetadata( metadata ) {
    this.clearMetadata();

    let md = document.querySelector( this.config.DOMConfig.metadata );

    let textArea = document.createElement('textarea');
    let text     = document.createTextNode( JSON.stringify( metadata, 1) );
    textArea.appendChild( text );

    md.appendChild(textArea);
  }

  clearDirectoryListing() {
    let element = document.querySelector( this.config.DOMConfig.directory );
    Array.from( element.children ).forEach( (child) => {
      child.remove();
    });
  }

  clearFileContents() {
    let element = document.querySelector( this.config.DOMConfig.file );
    Array.from( element.children ).forEach( (child) => {
      child.remove();
    });    
  }

  clearMetadata() {
    let element = document.querySelector( this.config.DOMConfig.metadata );
    Array.from( element.children ).forEach( (child) => {
      child.remove();
    });    
  }

  clear() {
    clearMetadata();
    clearDirectoryListing()
    clearFileContents();
  }
 
}

EleventyEditor.defaultConfig = {
  DOMConfig: {
    directory: "#listing",
    file     : "#editor",
    metadata : "#metadata",
    repository: "#repository",
  },
  matter   : {
    delimiter: "---"
  },
  handlers : {
    'js': {
      read: ( content ) => {
	return `<pre>${content}</pre>`;
      },
    },
    'json': {
      read: ( content ) => {
	return `<pre>${content}</pre>`;
      }
    },
    'md': {
      read: ( content ) => {
	let md = markdownit();
	return md.render( content );
      },
      write: ( content, metadata ) => {
	  let td = new TurndownService({ headingStyle: 'atx' });
	let md = td.turndown( content );
	let fm = jsyaml.dump( metadata );
	let fdata = "---\n" + fm + "---\n" + md;
        return fdata;
      }
    },
  }
};

export { EleventyEditor, EventEmitter }
