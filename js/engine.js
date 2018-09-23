const SIZE_MULTIPLIER = 4;
const STEEM_MULTIPLIER = 1000 * SIZE_MULTIPLIER;
const TAG_MULTIPLIER = 1 * SIZE_MULTIPLIER;
const ACCOUNT_MULTIPLIER = 0.001 * SIZE_MULTIPLIER;
const NO_ACCOUNTS = new URL(window.location.href).searchParams.get('no_accs');

const initData = {
	nodes: [],
	links: []
};

var Graph;
var elem;

var tagGeometries = {}; // indexed by node value
var accountGeometries = {}; // indexed by node value
var sphereMaterials = {}; // indexed by color
var steemTexture = new THREE.TextureLoader().load('img/steem.jpg');


function init(){
	Graph = ForceGraph3D()
			(document.getElementById('3d-graph'));
	elem = document.getElementById('3d-graph');

	Graph
		.graphData(initData)
		.enableNodeDrag(false)
		.cooldownTime(5000)
		.backgroundColor('black')
		.nodeRelSize(SIZE_MULTIPLIER)
		.nodeId('id')
		.nodeLabel(nodeLabel)
		.linkVisibility(link => typeof link.source === 'string' ? link.source.startsWith('#') : link.source.id.startsWith('#'))
		.linkOpacity(0.2)
		.linkDirectionalParticleWidth(2)
		.linkDirectionalParticleColor(link => link.source.color)
		.nodeAutoColorBy(node => node.category ? node.category : node.id)
		.onNodeClick(focusCamera)
		.onNodeHover((node, nodePre) => {
			elem.style.cursor = node ? 'pointer' : null;

			// no state change
			if (!node && !nodePre)
				return;

			if (node && node.fx != 0)
			{
				let outlineMaterial = new THREE.MeshBasicMaterial( { color: 'cyan', side: THREE.BackSide } );
				let outlineMesh = new THREE.Mesh( node.__threeObj.children[0].geometry, outlineMaterial );
				outlineMesh.position = node.__threeObj.position;
				outlineMesh.scale.multiplyScalar(1.05);
				node.__threeObj.add(outlineMesh);
			}
			if (nodePre && nodePre.fx != 0 && nodePre.__threeObj.children && nodePre.__threeObj.children.length > 0) {
				let obj = nodePre.__threeObj.children[nodePre.__threeObj.children.length - 1];
				nodePre.__threeObj.remove(obj);
				deallocate(obj);
			}
		})
		
		.nodeThreeObject(nodeThreeObject)

		// a little upwards and more away
		.cameraPosition({ z: 7500 });

	Graph.d3Force('charge', null);
	Graph.d3Force('center', null);
	Graph.d3Force('collision', d3.forceCollide(node => {
		// node sphere collision
		if (node.id == '#steem')
			return Math.cbrt(node.count * STEEM_MULTIPLIER);
		else if (node.id.startsWith('#'))
			return Math.cbrt(node.count * TAG_MULTIPLIER) * 2;
		else
			return Math.cbrt(node.sp * ACCOUNT_MULTIPLIER) * 2;
	}));
	Graph.d3Force('link').distance(link =>{
		// accounts
		if (!link.source.id.startsWith('#'))
		{
			let distance = Math.cbrt(link.target.count * TAG_MULTIPLIER);
			return distance * (1 + 3 * (1 - link.strength / 100));
		}
		// tags
		return 60;
	})
	Graph.d3Force('centerTags', centerTags());
	Graph.d3Force('collideTags', collideTags());

	// load data
	let url = new URL(window.location.href);
	let c = url.searchParams.get('data');
	let jsonData = 'data/' + (c ? c : 'categories') + '.json';
	d3.json(jsonData).then(function(data) {
		console.log(data);
		Graph.graphData({
			nodes: [...data.nodes],
			links: [...data.links]
		});

		// snapshot datestamp
        let container = document.createElement('div');
        container.className = 'snapshot d-none d-md-block';
		let text = document.createTextNode('Snapshot: ' + data.snapshot);
		container.appendChild(text); 
		document.body.appendChild(container);

		if (NO_ACCOUNTS == null)
			setTimeout(
				function() {
					// stick tags
					Graph.graphData().nodes.forEach(function(node, index, object) {
						object[index].fx = object[index].x;
						object[index].fy = object[index].y;
						object[index].fz = object[index].z;
					});
					loadAccounts();
				}, 5000);
		
		// transit camera
		Graph.cameraPosition(
			{ z: 750 }, // new position
			({ x: 0, y: 0, z: 0 }), // lookAt ({ x, y, z })
			5500 // ms transition duration
		);
		loadingBar(1);
	});
	
	// optimize draw calls by +5 FPS
	Graph.renderer().sortObjects = false;

	skybox();
	// startOrbit();
}


function loadingBar(percent){
	$('#progressvalue').attr('aria-valuenow', percent).css('width', percent + '%');
	if (percent == 100)
		$('#progressbar').attr('style', 'display:none');
	else
		setTimeout(function() {
			loadingBar(percent + 1);
		}, 75);
}


function loadAccounts(){
	// load data
	return d3.json('data/accounts.json').then(function(data) {
		console.log(data);
		data.nodes.forEach(function(node, i, object) {
			// init position based on first 3 characters
			var tag = Graph.graphData().nodes.find(n => n.id==object[i].category);
			object[i].x = tag.x + (object[i].id.charCodeAt(0) - 109) * 10;
			object[i].y = tag.y + (object[i].id.charCodeAt(1) - 109) * 10;
			object[i].z = tag.z + (object[i].id.charCodeAt(2) - 109) * 10;
		})

		Graph.graphData({
			nodes: [...Graph.graphData().nodes, ...data.nodes],
			links: [...Graph.graphData().links, ...data.links]
		});
		Graph.linkDirectionalParticles(2);
	});
}


function skybox(){
	var directions  = ["img/skyboxes/Stars01/leftImage.png", "img/skyboxes/Stars01/rightImage.png", "img/skyboxes/Stars01/upImage.png", "img/skyboxes/Stars01/downImage.png", "img/skyboxes/Stars01/frontImage.png", "img/skyboxes/Stars01/backImage.png"];
	var reflectionCube = new THREE.CubeTextureLoader().load(directions, function(){
		reflectionCube.format = THREE.RGBFormat;
		scene.background = reflectionCube;
	});
}


function nodeLabel(node){
	let debug = '';
	if (DEBUG & 4){
		// show coordinates
		debug = '<br>[' + parseInt(node.x) + ',' + parseInt(node.y) + ',' + parseInt(node.z) + ']'
	}
	if (node.id.startsWith('#'))
		return '<center>' + node.id + ' ' + node.count + debug  + '</center>';
	else
		return '<center>' + node.id + ' (' + parseInt(node.sp) + ' SP)' + debug + '</center>';
}


function nodeSpriteText(text, color, height){
	let spriteText = new SpriteText(text);
	spriteText.fontSize = 36;
	spriteText.color = color;
	spriteText.textHeight = height;
	return spriteText;
}


function nodeThreeObject(node){
	let group = new THREE.Group();
	
	// steem
	if (node.id == '#steem'){
		let box = new THREE.BoxGeometry(120, 240, 20);
		let materials = [
			new THREE.MeshStandardMaterial({color: 0x333333}),
			new THREE.MeshStandardMaterial({color: 0x333333}),
			new THREE.MeshStandardMaterial({color: 0x333333}),
			new THREE.MeshStandardMaterial({color: 0x333333}),
			new THREE.MeshStandardMaterial({map: steemTexture}),
			new THREE.MeshStandardMaterial({map: steemTexture}),
		];
		let mesh = new THREE.Mesh(box, materials);
		mesh.rotation.x = -0.5;
		group.add(mesh);
		group.add(nodeSpriteText(
			node.id, 'dodgerblue', Math.cbrt(node.count * STEEM_MULTIPLIER) / 5));
	
		setInterval(() => {
			mesh.rotation.y += 0.03;
		}, 30);
	}
	// tags
	else if (node.id.startsWith('#')){
		// share geometries for better performance (/1k size)
		let val = Math.ceil(node.count / 1000);
		if (!tagGeometries.hasOwnProperty(val)) {
			tagGeometries[val] = new THREE.SphereGeometry(Math.cbrt(node.count * TAG_MULTIPLIER));
		}

		let color = node.color;
		if (!sphereMaterials.hasOwnProperty(color)) {
			sphereMaterials[color] = new THREE.MeshLambertMaterial({
				color: node.color
			});
		}
		group.add(new THREE.Mesh(tagGeometries[val], sphereMaterials[color]));
		group.add(nodeSpriteText(
			node.id, node.color, Math.cbrt(node.count * TAG_MULTIPLIER) / 2));
	}
	// accounts
	else {
		// share geometries for better performance
		// plankton/minnow/dolphin/orca/whale
		let val = 1;
		if (node.sp > 500)
			val = 10;
		if (node.sp > 5000)
			val = 100;
		if (node.sp > 50000)
			val = 1000;
		if (node.sp > 500000)
			val = 10000;
		if (node.sp > 5000000)
			val = 100000;
		if (!accountGeometries.hasOwnProperty(val)) {
			accountGeometries[val] = new THREE.SphereGeometry(Math.cbrt(val));
		}

		let color = node.color;
		if (!sphereMaterials.hasOwnProperty(color)) {
			sphereMaterials[color] = new THREE.MeshLambertMaterial({
				color: node.color
			});
		}
		group.add(new THREE.Mesh(accountGeometries[val], sphereMaterials[color]));
	}
	
	return group;
}


function search(){
	value = document.getElementById("search_value").value;
	console.log(value);

	Graph.graphData().nodes.forEach(function(node) {
		if (node.id && node.id == value){
			focusCamera(node);
		}
	})
}


function focusCamera(node) {
	// Aim at node from outside it
	var distance = node.id.startsWith('#') 
		? Math.cbrt(node.count * TAG_MULTIPLIER) 
		: Math.cbrt(node.sp * ACCOUNT_MULTIPLIER);
	distance *= 13;
	const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)

	if (node.id.startsWith('#'))
		Graph.cameraPosition(
			{ 	x: node.x * distRatio * 1.2,
				y: node.y * distRatio * 0.8,
				z: node.z * distRatio
			}, // new position
			node, // lookAt ({ x, y, z })
			1000 // ms transition duration
		)
	else {
		var par = ''
		// change foreach to simple break loop
		Graph.graphData().nodes.forEach(function(parent) {
			if (parent.id == node.category)
				par = parent;
		});
		Graph.cameraPosition(
			{ 	x: node.x + (node.x - par.x) * distRatio * 1.2,
				y: node.y + (node.y - par.y) * distRatio * 0.8,
				z: node.z + (node.z - par.z) * distRatio
			}, // new position
			node, // lookAt ({ x, y, z })
			1000 // ms transition duration
		)
	}
}


function centerTags(){
	return selectiveCenterTags(
		d3.forceCenter(),
		// function(d){return d.type && d.type === 'tag';}
		function(d){return d.id.startsWith('#');}
	)
}


function collideTags(){
	return selective(
		d3.forceCollide(),
		function(d){return d.type === 'tag';}
	)
	.radius(node => Math.cbrt(node.count * TAG_MULTIPLIER) * 5);
}


// unused
function setFog() {
	let fog = new THREE.Fog('black', 100, 2000);
	// let fog = new THREE.FogExp2('black', 0.00025);
	Graph.backgroundColor('black');
	Graph.scene().fog = fog;
}


// unused
function startOrbit() {
	// https://github.com/artyomtrityak/d3-explorer/blob/master/static/javascript/components/3d-charts/force-3d-camera.js
	const distance = 2000;
	let angle = 0;

	setInterval(() => {
		angle = angle + Math.PI / 300;
		Graph.cameraPosition({
			x: distance * Math.sin(angle),
			z: distance * Math.cos(angle)
		});
	}, 30);
}


function deallocate(obj) {
	if (obj.geometry) {
		obj.geometry.dispose();
	}
	if (obj.material) {
		if (Array.isArray(obj.material)) {
			obj.material.forEach(material => {
				material.dispose();
			});
		}
		else {
			obj.material.dispose(); 
		}
	}
	if (obj.texture) {
		obj.texture.dispose();
	}
	if (obj.children) {
		obj.children.forEach(deallocate);
	}
};


// selective helper (3 dimension)
function selective(force, filter) {
	let init = force.initialize;
	force.initialize = function(f){
		return init(f.filter(filter), 3);
	};
	return force;
}


// selective helper (2 dimension)
function selectiveCenterTags(force, filter) {
	let init = force.initialize;
	force.initialize = function(f){
		return init(f.filter(filter));
	};
	return force;
}