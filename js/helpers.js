/*
	DEBUG mask
	& 1 - show stats
	& 2 - show grid axis
	& 4 - show node coordinates
*/
const DEBUG = new URL(window.location.href).searchParams.get('debug');
var stats;

function helpers(){
	if (DEBUG & 1){
		// Add stats to page.
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '42px';
		stats.domElement.style.left = '5px';
		stats.domElement.style.zIndex = 1;
		document.body.appendChild(stats.domElement);
		animate();
	}
	if (DEBUG & 2){
		// gridHelper
		let gridHelper = new THREE.GridHelper(2048 , 8);
		gridHelper.color2 = 0x00aaaa50;
		gridHelper.transparent = true;
		scene.add(gridHelper);

		// axisHelper
		let axes = new THREE.AxesHelper(1024);
		scene.add(axes);
	}
}


function animate() {
	requestAnimationFrame(animate);
	stats.update();
}