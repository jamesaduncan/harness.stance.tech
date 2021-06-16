import http from 'https://unpkg.com/isomorphic-git@beta/http/web/index.js'

// Initialize isomorphic-git with a file system
window.fs = new LightningFS('fs')

// I prefer using the Promisified version honestly
window.pfs = window.fs.promises

const dir = '/'
let clone = await git.clone({
    fs,
    http,
    dir,
    url: 'https://github.com/jamesaduncan/osom.guide.git', //'https://github.com/isomorphic-git/lightning-fs',
    corsProxy: 'https://cors.isomorphic-git.org',
    force: true
});

let fdata = await pfs.readFile('/src/index.md', { encoding: "utf8" });

let config = {
    DOMConfig: {
	directory: "listing",
	file     : "editor"
    },
    handlers : {
	'md': ( content ) => {
	    let md = markdownit();
	    return md.render( content );
	}
    }
}

class Path {
    constructor( aPath ) {
	this.fullpath = aPath;
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

function clear() {
    clearDirectoryListing()
    clearFileContents();
}

async function drawFile( aFile ) {
    clearFileContents();
    let elem = document.getElementById( config.DOMConfig.file );
    let fdata = await pfs.readFile(aFile, { encoding: "utf8" });
    elem.innerHTML = fdata;
}

async function drawDirectory( aPath = "/" ) {
    let list = await pfs.readdir(aPath);

    clearDirectoryListing();
    clearFileContents();
    
    let ul = document.createElement('ul');
    list.forEach( async (entry) => {
	let fullpath = [aPath, entry].join("");
	let dirent   = await pfs.stat(fullpath);
	
	let li  = document.createElement('li');
	let a   = document.createElement('a');
	if ( dirent?.type == 'dir' ) entry += "/";
	
	let txt = document.createTextNode( entry );	
	a.appendChild(txt);
	a.setAttribute('href', "/#" + [aPath, entry].join(""));	
	li.appendChild(a);
	ul.appendChild(li);
    });
    document.getElementById( config.DOMConfig.directory ).appendChild(ul);    
}

async function display() {
    let [,path] = (window.location.hash || "#/").match(/\#(.+)$/); // always trim the top of the hash
    let dirent = await pfs.stat(path); 
    if ( dirent?.type == 'file' ) {
	await drawFile( path );
    } else if ( dirent?.type == 'dir' ) {
	await drawDirectory( path );
    } else {
	throw new Error(`unknown file type ${dirent?.type}`);
    }
}

export { display, config }
