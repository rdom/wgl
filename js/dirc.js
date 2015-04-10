/**
 * @author rdom https://github.com/rdom 
 */


var camera, scene, renderer, objects=[], sceneCube, cameraCube;
var particleLight, lightMesh, dae;

var r = "img/textures/";
var urls = [ r + "px.jpg", r + "nx.jpg", r + "py.jpg", r + "ny.jpg", r + "pz.jpg", r + "nz.jpg" ];
var textureCube;

var container, stats, gui = null, controls;
var mouse, raycaster,particleMaterial, rotationPoint;
var composer;

THREE.PhotonPath = THREE.Curve.create(
    function ( points /* array of Vector3 */) {
	this.points = ( points == undefined ) ? [] : points;
    },
    function ( t ) {
	var points = this.points;
	var point = ( points.length - 1 ) * t;
	var intPoint = Math.floor( point );
	var weight = point - intPoint;
	var point1 = points[ intPoint ];
	var point2 = points[ intPoint > points.length - 2 ? points.length - 1 : intPoint + 1 ];
	var v = new THREE.Vector3();
	v.copy( point1 ).lerp( point2, weight );
	return v;
    }
);

var newgeo=true, geoDone=false, tracksDone=false, allDone=false;
var gpath, timeline=[];
var megatronId= 0, npath, maxlen;
var pphotons,particleSystem, tracks;
var chromColors = [], brightColors = [];
var nameGeo="data/barL3.dae";
var nameTrk="data/pathBarL3.json";
var nEvents = 1;


$( document ).ready(function() {
    init();
    animate();
});


function getPath(){
    $.ajaxSetup({ cache: false });	
    $.getJSON(nameTrk, function(obj) {
	var varr= [[]], energy=[];
	gpath=[];
	maxlen = 0;
	npath = 0;
	for(var key=0 ; key<obj.event.length;key += 2){
	    energy[npath]=obj.event[key].energy;
	    if(energy[npath]>5) megatronId = npath;	    
	    
	    varr[npath] = [];
	    for(var tp in obj.event[key+1].path){
		if(tp==0){
		    v = new THREE.Vector3(); 
		    v.x = obj.event[key+1].path[tp].v[0];
		    v.y = obj.event[key+1].path[tp].v[1];
		    v.z = obj.event[key+1].path[tp].v[2];
		    varr[npath].push(v);
		}

		v = new THREE.Vector3(); 
		v.x = obj.event[key+1].path[tp].v[0];
		v.y = obj.event[key+1].path[tp].v[1];
		v.z = obj.event[key+1].path[tp].v[2];
		varr[npath].push(v);


		v = new THREE.Vector3(); 
		v.x = obj.event[key+1].path[tp].v[0];
		v.y = obj.event[key+1].path[tp].v[1];
		v.z = obj.event[key+1].path[tp].v[2];
		varr[npath].push(v);
	    }
	    varr[npath].pop();
	    npath++;
	}
	npath--;
	console.log("npath "+npath);
	var mline = new THREE.LineBasicMaterial( { color: 0xeeaa00, transparent: true, opacity: 0.2, linewidth: 1} );
	var mphoton = new THREE.MeshBasicMaterial({color: 0xeeaa00, transparent: true, opacity: 1,});	

	pphotons = new THREE.Geometry();
	var gtracks = new THREE.Geometry();	


	for (var p = 0; p < npath*100; p++) {
	    pphotons.vertices.push(new THREE.Vector3(0, 0, 0));	 
	}	

	for (var p = 0; p < npath; p++) {
	    gpath[p] = new THREE.PhotonPath(varr[p]);
	    gpath[p].__arcLengthDivisions = 100000;
	    gpath[p].updateArcLengths();
	    timeline[p]=0;
	    
	    var len = gpath[p].getLength();
	    if(len>maxlen) maxlen = len;
	    if(len<50)continue;
	    
	    var gline = new THREE.Geometry();
	    gline.vertices = varr[p];	    
	    gtracks.merge(gline);
	}
	
	tracks = new THREE.Line(gtracks, mline,THREE.LinePieces);
	var pmaterial = new THREE.PointCloudMaterial({
	    color: 0xFFFFFF,
	    vertexColors: THREE.VertexColors,
	    size: 8,
	    map: THREE.ImageUtils.loadTexture(
		//"spark1.png" 
		"img/particle.png"
	    ),
	    depthTest: false,
	    blending: THREE.AdditiveBlending,
	    opacity: 0.9,
	    transparent: true
	});
	
	particleSystem = new THREE.PointCloud(pphotons,pmaterial);
	for (var p = 0; p < npath*100; p++) {
	    var pp = p - npath* Math.floor(p/npath);
            chromColors[p] = new THREE.Color(wavelengthToColor(1.24/(energy[pp]*1000))[0]);
	    brightColors[p] = new THREE.Color("rgb(255,255,255)"); 
	}
	particleSystem.geometry.colors = brightColors;

	tracksDone = true;
	console.log("loading track .. done. npath = " + npath);
    }).fail(function() {
	console.log( "error" );
    });    
}

function getGeo(){
    var loader = new THREE.ColladaLoader();
    loader.options.convertUpAxis = true;
    loader.load(nameGeo, function ( collada ) {
	dae = collada.scene;
	dae.traverse( function ( child ) {
	    if ( child instanceof THREE.SkinnedMesh ) {
		var animation = new THREE.Animation( child, child.geometry.animation );
		animation.play();
	    }
	} );

	dae.rotation.set( -Math.PI * 0.5, 0.5, 0.5 );
	dae.updateMatrix();
	geoDone = true;
    } );
}

function init() {
    if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

    container = document.createElement( 'div' );
    document.getElementById('container').appendChild( container );

    scene = new THREE.Scene();
    scene2 = new THREE.Scene();
    //sceneCube = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
    cameraCube = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.set( 200, 200, 200 );
    scene.add(camera);

    //scene.fog = new THREE.FogExp2( 0x000000, 0.001 );
    textureCube = THREE.ImageUtils.loadTextureCube( urls, THREE.CubeRefractionMapping );

    // Skybox
    var shader = THREE.ShaderLib[ "cube" ];
    shader.uniforms[ "tCube" ].value = textureCube;

    /*var smaterial = new THREE.ShaderMaterial( {
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
      uniforms: shader.uniforms,
      side: THREE.BackSide
      } )
      var skymesh = new THREE.Mesh( new THREE.BoxGeometry( 10000, 10000, 10000 ), smaterial );
      sceneCube.add(skymesh);*/

    // Renderer
    renderer = new THREE.WebGLRenderer({antialias: true });
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( 1200, 700 ); // ( window.innerWidth, window.innerHeight );
    renderer.autoClear = false;

    container.appendChild( renderer.domElement );

    // Stats
    stats = new Stats();
    container.appendChild( stats.domElement );

    // Events
    window.addEventListener( 'resize', onWindowResize, false );
    renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown );
    
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    controls = new THREE.TrackballControls( camera, renderer.domElement);
    controls.rotateSpeed = 10.0;
    controls.zoomSpeed = 10.0;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.noPan = false;
    controls.minDistance=10;
    controls.maxDistance=1000;
    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.8;
    controls.keys = [ 65, 83, 68 ];
    controls.addEventListener( 'change', render );

    setupGui();
}

function onDocumentMouseDown( event ) {
    if( event.button == 2 ) { 
	mouse.x = ( event.clientX / renderer.domElement.width ) * 2 - 1;
	mouse.y = - ( event.clientY / renderer.domElement.height ) * 2 + 1;
	raycaster.setFromCamera( mouse, camera );

	var intersects = raycaster.intersectObjects( objects );
	if ( intersects.length > 0 ) {
	    controls.target = intersects[0].point;
	    rotationPoint.position.copy(intersects[0].point);
	}
    }
}

function movePhoton() {
    var megatronPos=0;
    if (timeline[megatronId] <= maxlen) {
	var ratio = timeline[megatronId]/gpath[megatronId].getLength();
	if (ratio> 1) ratio=1; 
	megatronPos = gpath[megatronId].getPointAt(ratio);
	pphotons.vertices[megatronId] =  megatronPos;
	timeline[megatronId]  += effectController.speed;
    }else{
	timeline[megatronId] = 0;
    }

    for (var p = 0; p < npath*nEvents; p++) {	
	var pp = p - npath* Math.floor(p/npath);
	if (timeline[p] <= maxlen) {
	    if(megatronPos.z < gpath[pp].points[0].z) continue;	    

	    var ratio = timeline[p] /gpath[pp].getLength();
	    if (ratio> 1) ratio=1;
	    pphotons.vertices[p] =  gpath[pp].getPointAt(ratio);          
	    timeline[p]  += effectController.speed;
	}else {
	    timeline[p]  = 0;
	}
    }

    particleSystem.geometry.verticesNeedUpdate = true;
}

var scover, strigger1, strigger2;
function addGeo() {
    var obj;
    for ( var i = scene.children.length - 1; i >= 0 ; i -- ) {
	obj = scene.children[ i ];
	if ( obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.PointCloud) {
            scene.remove(obj);
	}
    }
    for ( var i = scene2.children.length - 1; i >= 0 ; i -- ) {
	obj = scene2.children[ i ];
	if ( obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.PointCloud) {
            scene2.remove(obj);
	}
    }
   
    scene.add(tracks);
    scene2.add(particleSystem);
    
    //rotation point
    var gshp = new THREE.SphereGeometry(1, 32, 32);
    rotationPoint = new THREE.Mesh(gshp, new THREE.MeshBasicMaterial({color: 0x00ff00}));
    scene.add(rotationPoint);
 
    var mNlak         = new THREE.MeshBasicMaterial( { color: 0xccddff, envMap: textureCube, refractionRatio: 0.98, reflectivity:0.9, transparent: true, opacity: 0.3} );
    var mFusedSillica = new THREE.MeshBasicMaterial( { color: 0xccfffd, envMap: textureCube, refractionRatio: 0.99, reflectivity:0.9, transparent: true, opacity: 0.4} );
    var material = new THREE.MeshBasicMaterial( { color: 0xccfffd, shading: THREE.FlatShading, wireframe: true } )    
    var mm = new THREE.MeshBasicMaterial( { color: 0x5C001F /*0xccfffd*/, shading: THREE.FlatShading } )
    material = mFusedSillica;
    dae.material = mFusedSillica;
    if (dae.children) {
	for (var i = 0; i < dae.children.length; i++) {
	    if(!dae.children[i].children[0]) continue;

	    var mesh = new THREE.Mesh(dae.children[i].children[0].geometry, mm);
	    mesh.rotation.set( Math.PI * 0.5, 0, 0 );
	    //edges.material= new THREE.LineBasicMaterial( { color: 0xffaa00, opacity: 0.5, linewidth: 0.1 } );

	    if(dae.children[i].name == "ShapeIndexedFaceSet")      strigger1 = mesh;	
	    if(dae.children[i].name == "ShapeIndexedFaceSet_001" ) strigger2 = mesh;	
	    if(dae.children[i].name == "ShapeIndexedFaceSet_002" ) scover = mesh;

	    if(dae.children[i].name == "ShapeIndexedFaceSet_003" ||
	       dae.children[i].name == "ShapeIndexedFaceSet_008"){

		mesh.material = material;
	        var edges = new THREE.EdgesHelper(mesh,"#ff0000");
		edges.material= new THREE.LineBasicMaterial( { color: 0xffaa00, transparent: true, opacity: 0.6, linewidth: 1} );
		edges.material.blending = THREE.AdditiveBlending;
		scene.add(edges);		
	    }
	    //lens
            if(dae.children[i].name == "ShapeIndexedFaceSet_005" || 
	       dae.children[i].name == "ShapeIndexedFaceSet_006" || 
	       dae.children[i].name == "ShapeIndexedFaceSet_007"){

		mesh.material = material;
		if( dae.children[i].name == "ShapeIndexedFaceSet_006") mesh.material = new THREE.MeshBasicMaterial( { color: 0xccddff, envMap: textureCube, refractionRatio: 0.98, reflectivity:0.9, transparent: true, opacity: 0.5} );
		var edges = new THREE.EdgesHelper(mesh,"#ff0000");
		edges.material= new THREE.LineBasicMaterial( { color: 0xffaa00, transparent: true, opacity: 0.2, linewidth: 1} );
		scene.add(edges);
	    }	
	    //mirror
	    if(dae.children[i].name == "ShapeIndexedFaceSet_004"){
		mesh.material = new THREE.MeshBasicMaterial( { color: 0xffffff, envMap: textureCube /*THREE.ImageUtils.loadTexture( 'metal.jpg', THREE.SphericalReflectionMapping)*/ , combine: THREE.MixOperation, reflectivity: 0.3 } )
	    }
	    
	    //edges.material.linewidth = 1;
	    mesh.renderOrder=1;
	    scene.add(mesh);
	    objects.push(mesh);
	}
    }
}

function onWindowResize( event ) {
    renderer.setSize( window.innerWidth, window.innerHeight );
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    //composer.reset();
}

function animate() {
    requestAnimationFrame( animate );
    render();
    stats.update();
    controls.update();
}

function render() { 
    if(newgeo) {
	newgeo = false;
	geoDone=false;
	tracksDone=false;
	allDone=false;
	getGeo();
	getPath();
    }

    if(geoDone && tracksDone && !allDone){
	addGeo();
	allDone=true;
    }

    if(allDone){
	rotationPoint.visible = effectController.showcenter;
	if(tracks) tracks.visible = effectController.showtracks;
	scover.visible = effectController.covers;
	strigger1.visible = effectController.triggers;
	strigger2.visible = effectController.triggers;

	//cameraCube.rotation.copy( camera.rotation );
	//renderer.render( sceneCube, cameraCube );    

	if(npath>0) movePhoton();

	renderer.clear();
	renderer.render( scene, camera );
	renderer.clearDepth();
	renderer.render( scene2, camera );    
    }
}

function setupGui() {

    effectController = {
	covers:false,
	triggers:false,
	lens:  true,
	plate: false,
	
	showcenter: true,
	showtracks: true,
	showchrom: false,

	hue: 0.0,
	saturation: 0.8,
	lightness: 0.1,

	lhue: 0.04,
	lsaturation: 1.0,
	llightness: 0.5,

	speed: 10,
	reset: function() {
	    for(var i =0; i<npath*nEvents;i++){
		timeline[i] = 0;
		pphotons.vertices[i].set(0,0,-2000);
	    }
	    nEvents=1;
	    particleSystem.geometry.verticesNeedUpdate = true;
	},
	nextevent: function() {
	    for (var p = 0; p < npath*nEvents; p++) timeline[p+npath*nEvents] = 0;    
	    nEvents++;
	},
	
	dummy: function() {
	}
    };

    var gui = new dat.GUI();
    h = gui.addFolder( "Point light color" );
    h.add( effectController, "lhue", 0.0, 1.0, 0.025 ).name("hue");
    h.add( effectController, "lsaturation", 0.0, 1.0, 0.025 ).name("saturation");
    h.add( effectController, "llightness", 0.0, 1.0, 0.025 ).name("lightness");

    h = gui.addFolder( "Geometry configuration" );
    h.add( effectController, "covers" );
    h.add( effectController, "triggers" );
    //h.add( effectController, "lens" );
    h.add( effectController, "plate" ).onFinishChange(function(){
	if(effectController.plate){
	    nameGeo="data/plateL2.dae";
	    nameTrk="data/pathPlateL2.json";
	}else{
	    nameGeo="data/barL3.dae";
	    nameTrk="data/pathBarL3.json";
	}
	newgeo=true;
    });

    h = gui.addFolder( "View" );
    h.add( effectController, "showcenter" ).name("Show center");
    h.add( effectController, "showtracks" ).name("Show tracks");
    h.add( effectController, "showchrom" ).name("Show chrom").onFinishChange(function(){
	if(particleSystem){
	    if(effectController.showchrom) particleSystem.geometry.colors = chromColors;
	    else particleSystem.geometry.colors = brightColors;
	    particleSystem.geometry.colorsNeedUpdate = true;
	}
    });
    h = gui.addFolder( "Speed" );
    h.add( effectController, "speed", 0.01, 1, 0.01 ).name("Speed 0-1");
    h.add( effectController, "speed", 1, 100, 1 ).name("Speed 1-100");
    gui.add(effectController, 'reset');
    gui.add(effectController, 'nextevent').name("Add same event");
}

// takes wavelength in nm and returns an rgba value
function wavelengthToColor(wavelength) {
    var r,g,b,alpha,
    colorSpace,
    wl = wavelength,
    gamma = 1;
    
    if (wl >= 380 && wl < 440) {
        R = -1 * (wl - 440) / (440 - 380);
        G = 0;
        B = 1;
    } else if (wl >= 440 && wl < 490) {
        R = 0;
        G = (wl - 440) / (490 - 440);
        B = 1;  
    } else if (wl >= 490 && wl < 510) {
        R = 0;
        G = 1;
        B = -1 * (wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
        R = (wl - 510) / (580 - 510);
        G = 1;
        B = 0;
    } else if (wl >= 580 && wl < 645) {
        R = 1;
        G = -1 * (wl - 645) / (645 - 580);
        B = 0.0;
    } else if (wl >= 645) { //if (wl >= 645 && wl <= 780)
        R = 1;
        G = 0;
        B = 0;
    } else {
        R = 1;
        G = 1;
        B = 1;
    }
    
    // intensty is lower at the edges of the visible spectrum.
    if (wl > 780 || wl < 380) {
        alpha = 0;
    } else if (wl > 700) {
        alpha = (780 - wl) / (780 - 700);
    } else if (wl < 420) {
        alpha = (wl - 380) / (420 - 380);
    } else {
        alpha = 1;
    }
    
    //    colorSpace = ["rgba(" + (R * 100) + "," + (G * 100) + "," + (B * 100) + ", " + alpha + ")", R, G, B, alpha]
        colorSpace = ["rgb(" + Math.floor(R * 255) + "," + Math.floor(G * 255) + "," + Math.floor(B * 255) + ")", R, G, B, alpha];

    return colorSpace;
}

