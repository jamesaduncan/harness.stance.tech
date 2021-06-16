import http from 'https://unpkg.com/isomorphic-git@beta/http/web/index.js'

let config = {
    DOMConfig: {
	directory: "listing",
	file     : "editor",
	metadata : "metadata"
    },
    matter   : {
	delimiter: "---"
    },
    handlers : {
	'md': {
	    read: ( content ) => {
		let md = markdownit();
		return md.render( content );
	    },
	    write: ( content, metadata ) => {
		let td = new TurndownService();
		let md = td.turndown( content );
		let fm = jsyaml.dump( metadata );
		let fdata = "---\n" + fm + "---\n" + md;
		return fdata;
	    }
	},
    }
}

class Matter {
    static hasMatter( aString ) {
	let at = aString.indexOf( config.matter.delimiter );
	return (at != -1 && at == 0);
    }

    static parse( aString ) {
	let content, meta = ["", {}];
	let at = aString.indexOf( config.matter.delimiter );
	if (at != -1 && at == 0) {
	    // we have some front matter
	    let end = aString.indexOf( config.matter.delimiter, 1);
	    content = aString.substring( end + config.matter.delimiter.length );
	    meta    = jsyaml.load( aString.substring( 0 + config.matter.delimiter.length, end) );
	}
	return [ content, meta ];
    }
}

class Path {
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
		    if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
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

function clearDirectoryListing() {
    let element = document.getElementById( config.DOMConfig.directory );
    Array.from( element.children ).forEach( (child) => {
	child.remove();
    });
}

function clearFileContents() {
    let element = document.getElementById( config.DOMConfig.file );
    Array.from( element.children ).forEach( (child) => {
	child.remove();
    });    
}

function clearMetadata() {
    let element = document.getElementById( config.DOMConfig.metadata );
    Array.from( element.children ).forEach( (child) => {
	child.remove();
    });    
}

function clear() {
    clearMetadata();
    clearDirectoryListing()
    clearFileContents();
}

function drawMetadata( metadata ) {
    clearMetadata();
    let md = document.getElementById( config.DOMConfig.metadata );
    let textArea = document.createElement('textarea');
    let text     = document.createTextNode( JSON.stringify( metadata, 1) );
    textArea.appendChild( text );
    md.appendChild(textArea);
}


class GITEditor {

    constructor( url, config ) {
	// Initialize isomorphic-git with a file system
	let fs = this.fs = new LightningFS('fs')
	
	// I prefer using the Promisified version honestly
	this.pfs    = this.fs.promises
	this.repo   = url;
	this.config = config;
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

    async drawFile( aFile ) {
	clearFileContents();
	let elem = document.getElementById( config.DOMConfig.file );
	
	let p = new Path( aFile );
	this.drawDirectory(p.path);

	let fdata = await this.pfs.readFile(aFile, { encoding: "utf8" });

	let [content, metadata] = [ "", {} ];
	if (Matter.hasMatter(fdata)) {
	    [ content, metadata ] = Matter.parse( fdata );
	} else content = fdata;
	    
	drawMetadata( metadata );

	elem.innerHTML = config.handlers?.[ p.extension ]?.read( content ) || content;
    }

    async drawDirectory( aPath = "/" ) {
	let list = await this.pfs.readdir(aPath);

	clearDirectoryListing();
	clearFileContents();
    
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
	
	document.getElementById( config.DOMConfig.directory ).appendChild(ul);    
    }

}

export { config, GITEditor }
