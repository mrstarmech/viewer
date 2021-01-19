"use strict";

const VECTOR_U = new THREE.Vector3(0,1,0);
const VECTOR_R = new THREE.Vector3(1,0,0);
const VECTOR_F = new THREE.Vector3(0,0,-1);
const EPSILON = 1e-7;
const ZOOM_SENSE = 9;
const MOUSE_SENSE = 0.8;
const FOV_MIN = 5;
const FOV_DEFAULT = 60;

function viewer (modelSource, modelOptions) {
    let clock = new THREE.Clock(true);
    let viewerContainer = document.getElementById("viewer-canvas");
    if(!viewerContainer) {
        console.error(`Can't find container canvas!`);
        return;
    }
    let renderer = new THREE.WebGLRenderer({
        canvas: viewerContainer,
        preserveDrawingBuffer: true,
    });
    renderer.setClearColor('#acacac',1.0);
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    renderer.outputEncoding = THREE.LinearEncoding;
    let scene = new THREE.Scene();

    let ambient = new THREE.AmbientLight('#ffffff', 1);
    scene.add(ambient);

    let camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000000);
    scene.add(camera);
    camera.position.set(0,0,30);
    camera.lookAt(0,0,0);

    let model3d;

    function load(){
        let loadedObject = modelFromSrc({
           model:'storage/model/tex_test.drc',
           textures: ['storage/textures/main_tex_bc3.dds'],
        });

        loadedObject.modelStatusChanged = function (status) {
            if(status === 1){
                model3d = loadedObject.model;
                model3d.geometry.computeBoundingSphere();
                scene.add(model3d);
                init();
            }
        };
    }

    let control;
    function init()
    {
        viewerContainer.addEventListener('mousedown',onMouseDown,false);
        viewerContainer.addEventListener('wheel', onMouseWheel,false);
        camera.updateProjectionMatrix();
        console.log(model3d.geometry.boundingSphere.radius);
        control = orbitControl(scene, model3d, camera, model3d.geometry.boundingSphere.radius * 2, 500);
        update();
    }

    function update()
    {
        control.move(clock.getDelta());
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        requestAnimationFrame(update);
    }

    function onMouseDown(){
        viewerContainer.addEventListener('mouseup', onMouseUp, false);
        viewerContainer.addEventListener('mouseout', onMouseOut, false);
        viewerContainer.addEventListener('mousemove', onMouseMove, false);
    }
    function onMouseUp(){
        viewerContainer.removeEventListener('mouseup', onMouseUp);
        viewerContainer.removeEventListener('mousemove', onMouseMove);
        viewerContainer.removeEventListener('mouseout', onMouseOut);
    }
    function onMouseOut(){
        viewerContainer.removeEventListener('mouseup', onMouseUp);
        viewerContainer.removeEventListener('mousemove', onMouseMove);
        viewerContainer.removeEventListener('mouseout', onMouseOut);
    }
    function onMouseMove(event){
        const e = {x:event.movementX, y:event.movementY, z:0};
        control.collectMouseDelta(e);
    }
    function onMouseWheel(event){
        const e = {x:0,y:0,z: event.deltaY};
        control.collectMouseDelta(e);
    }

    return {
        load
    };
}

function orbitControl(scene, objectToControl, camera, minDist, maxDist) {
    let mouseDelta = {x:0,y:0,wheel:0};

    function move(deltaTime) {
        const rotationAxis = new THREE.Vector3(mouseDelta.y * deltaTime,mouseDelta.x * deltaTime,0);
        const rotationAxisLen = rotationAxis.length();
        if(Math.abs(rotationAxisLen) > EPSILON) {
            rotationAxis.normalize();
            objectToControl.rotateOnWorldAxis(rotationAxis, rotationAxisLen * MOUSE_SENSE);
        }
        if(camera !== undefined && Math.abs(mouseDelta.wheel) > EPSILON){
            let desZ = camera.position.z + mouseDelta.wheel * deltaTime * (camera.position.z/maxDist);
            let z = Math.min(Math.max(minDist, desZ), maxDist);
            if(minDist > desZ){
                camera.fov = Math.max(camera.fov + mouseDelta.wheel * deltaTime * ZOOM_SENSE * (camera.fov / FOV_DEFAULT) * 0.01, FOV_MIN);
                camera.position.set(0,0,z);
            }else{
                if(camera.fov < FOV_DEFAULT){
                    camera.fov = Math.min(camera.fov + mouseDelta.wheel * deltaTime * ZOOM_SENSE * (camera.fov / FOV_DEFAULT) * 0.01, FOV_DEFAULT);
                }else{
                    camera.position.set(0,0,z);
                }
            }
            console.log('z:'+camera.position.z);
            console.log('fov:'+camera.fov);
        }
        resetMouseDelta();
    }

    function collectMouseDelta(delta){
        mouseDelta.x += delta.x;
        mouseDelta.y += delta.y;
        if(!isNaN(delta.z))mouseDelta.wheel += delta.z * ZOOM_SENSE;
    }

    function resetMouseDelta() {
        mouseDelta.x=0;
        mouseDelta.y=0;
        mouseDelta.wheel = 0;
    }

    return {
        move,
        collectMouseDelta
    };
}

function modelFromSrc(src) {
    let g = src.model;
    let array_t = src.textures;
    let array_d = src.drawings;
    let c = src.cleaner;
    let outObject = {
        modelStatus: 0,
        modelStatusChanged: undefined,
        model: undefined,
        mainTextureStatus: 0,
        mainTextureStatusChanged: undefined,
        mainTexture: undefined,
        textureArrayStatus: 0,
        textureArrayStatusChanged: undefined,
        textureArray: undefined,
        drawingsArrayStatus: 0,
        drawingsArrayStatusChanged: undefined,
        drawingsArray: undefined,
        cleanerStatus: 0,
        cleanerStatusChanged: undefined,
        cleaner: undefined
    };

    let material = new THREE.MeshLambertMaterial();

    let meshLoader = new THREE.DRACOLoader();
    meshLoader.setDecoderPath('/js/draco/');
    meshLoader.load(g,function (geometry){
        outObject.modelStatus = 1;
        outObject.model = new THREE.Mesh(geometry, material);
        if(typeof outObject.modelStatusChanged === 'function') outObject.modelStatusChanged(1);
    }, function ( xhr ) {
        let numFormat = new Intl.NumberFormat('en-US',{style:"percent"});
        console.log( numFormat.format( xhr.loaded / xhr.total ) + ' loaded' );

    }, function (error) {
        if(typeof outObject.modelStatusChanged === 'function') outObject.modelStatusChanged(-1);
        console.log(error);
    });

    let ddsLoader = new THREE.DDSLoader();
    ddsLoader.load(Array.isArray(array_t) ? array_t[0] : array_t,function(loaded_tex){
        outObject.mainTextureStatus = 1;
        outObject.mainTexture = loaded_tex;
        material.map = loaded_tex;
        if(typeof outObject.mainTextureStatusChanged === 'function') outObject.mainTextureStatusChanged(1);
    }, function ( xhr ) {
        let numFormat = new Intl.NumberFormat('en-US',{style:"percent"});
        console.log( '0 tex: ' + numFormat.format( xhr.loaded / xhr.total ) + ' loaded' );

    }, function (error) {
        if(typeof outObject.mainTextureStatusChanged === 'function') outObject.mainTextureStatusChanged(-1);
        console.log(error);
    });

    if(Array.isArray(array_t) && array_t.length > 1) {
        let array_t_loaded = [];
        for (let i = 1; i < array_t.length; i++) {
            const tex = array_t[i];
            const ddsLoader = new THREE.DDSLoader();
            ddsLoader.load(tex, function (loaded_tex) {
                array_t_loaded.push(loaded_tex);
                if (array_t_loaded.length === array_t.length - 1) {
                    outObject.textureArrayStatus = 1;
                    outObject.textureArray = array_t_loaded;
                    if (typeof outObject.textureArrayStatusChanged === 'function') outObject.textureArrayStatusChanged(1);
                }
            }, function (xhr) {
                let numFormat = new Intl.NumberFormat('en-US', {style: "percent"});
                console.log(i + ' tex: ' + numFormat.format(xhr.loaded / xhr.total) + ' loaded');

            }, function (error) {
                if (typeof outObject.textureArrayStatusChanged === 'function') outObject.textureArrayStatusChanged(-1);
                console.log(error);
            });
        }
    }

    if(Array.isArray(array_d) && array_d.length > 0) {
        let array_d_loaded = [];
        for (let i = 1; i < array_d.length; i++) {
            const tex = array_d[i];
            const ddsLoader = new THREE.DDSLoader();
            ddsLoader.load(tex, function (loaded_tex) {
                array_d_loaded.push(loaded_tex);
                if (array_d_loaded.length === array_d.length - 1) {
                    outObject.drawingsArrayStatus = 1;
                    outObject.drawingsArray = array_d_loaded;
                    if (typeof outObject.drawingsArrayStatusChanged === 'function') outObject.drawingsArrayStatusChanged(1);
                }
            }, function (xhr) {
                let numFormat = new Intl.NumberFormat('en-US', {style: "percent"});
                console.log(i + ' draw: ' + numFormat.format(xhr.loaded / xhr.total) + ' loaded');

            }, function (error) {
                if (typeof outObject.drawingsArrayStatusChanged === 'function') outObject.drawingsArrayStatusChanged(-1);
                console.log(error);
            });
        }
    }

    if(c !== undefined) {
        let cleanerLoader = new THREE.DDSLoader();
        cleanerLoader.load(c, function (loaded_tex) {
            outObject.cleanerStatus = 1;
            outObject.cleaner = loaded_tex;
            if (typeof outObject.cleanerStatusChanged === 'function') outObject.cleanerStatusChanged(1);
        }, function (xhr) {
            let numFormat = new Intl.NumberFormat('en-US', {style: "percent"});
            console.log('0 tex: ' + numFormat.format(xhr.loaded / xhr.total) + ' loaded');
        }, function (error) {
            if (typeof outObject.cleanerStatusChanged === 'function') outObject.cleanerStatusChanged(-1);
            console.log(error);
        });
    }

    return outObject;
}

let v = viewer();
if(v) v.load();