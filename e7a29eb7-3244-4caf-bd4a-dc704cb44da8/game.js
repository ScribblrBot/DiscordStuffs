const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.8, 0.9, 1, 1);
    scene.gravity = new BABYLON.Vector3(0, -0.5, 0);
    scene.collisionsEnabled = true;

    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0,1,0), scene);
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1,-2,-1), scene);
    dirLight.position = new BABYLON.Vector3(10,10,10);

    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width:100, height:100 }, scene);
    ground.checkCollisions = true;
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseTexture = new BABYLON.Texture("/textures/groundTexture.jpg", scene);
    groundMat.diffuseTexture.uScale = 20;
    groundMat.diffuseTexture.vScale = 20;
    ground.material = groundMat;

    const player = BABYLON.MeshBuilder.CreateCapsule("player", { height:2, radius:0.5 }, scene);
    player.position = new BABYLON.Vector3(0,1,0);
    player.checkCollisions = true;
    player.isVisible = false;

    const camera = new BABYLON.UniversalCamera("FPSCamera", player.position.add(new BABYLON.Vector3(0,1.6,0)), scene);
    camera.attachControl(canvas, true);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.5,1,0.5);
    camera.speed = 0.05;
    camera.inertia = 0.3;
    camera.minZ = 0.1;

    canvas.addEventListener("click", () => {
        canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
        if (canvas.requestPointerLock) canvas.requestPointerLock();
    });

    const inputMap = {};
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = true;
    }));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = false;
    }));

    const sensitivity = 0.001;
    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === canvas) {
            camera.rotation.y += e.movementX * sensitivity;
            camera.rotation.x += e.movementY * sensitivity;
            camera.rotation.x = BABYLON.Scalar.Clamp(camera.rotation.x, -Math.PI/2, Math.PI/2);
        }
    });

    const normalSpeed = 0.05;
    const shiftSpeed = 0.03;
    const jumpForce = 0.25;
    const gravity = -0.012;
    let isJumping = false;
    let jumpVelocity = 0;
    const standingHeight = 1.6;
    const crouchHeight = 1.2;
    let isSquatting = false;
    let canJump = true;
    let squatAnim = null;
    let squatWalkAnim = null;
    let standAnim = null;

    function createCrosshair() {
        const crosshair = document.createElement("div");
        crosshair.style.position = "absolute";
        crosshair.style.width = "20px";
        crosshair.style.height = "20px";
        crosshair.style.top = "50%";
        crosshair.style.left = "50%";
        crosshair.style.transform = "translate(-50%, -50%)";
        crosshair.style.zIndex = "1000";
        crosshair.style.pointerEvents = "none";
        
        // Simple crosshair design
        crosshair.innerHTML = `
            <div style="position:absolute; width:2px; height:14px; background:white; top:3px; left:9px;"></div>
            <div style="position:absolute; width:14px; height:2px; background:white; top:9px; left:3px;"></div>
            <div style="position:absolute; width:2px; height:2px; background:red; top:9px; left:9px; border-radius:50%;"></div>
        `;
        
        document.body.appendChild(crosshair);
        return crosshair;
    }
    
    const crosshair = createCrosshair();

    BABYLON.SceneLoader.ImportMesh("", "/glbs/", "4bb3a8d88abff1e7bb7ce34b87c64494.glb", scene,
        (meshes, ps, skels, anims) => {
            meshes.forEach(m => m.isVisible = false);

            squatAnim = anims.find(a => a.name.toLowerCase() === "squat");
            squatWalkAnim = anims.find(a => a.name.toLowerCase() === "squat_walk");
            standAnim = anims.find(a => a.name.toLowerCase() === "stand");

            if (standAnim) standAnim.start(true);
            console.log("Animations loaded: stand, squat, squat_walk");
        },
        null,
        (scene, err) => console.error("Failed to load body GLB:", err)
    );

    BABYLON.SceneLoader.ImportMesh("", "/glbs/", "ae1db540a529ec318de726647102b250.glb", scene,
        (meshes) => {
            const armsRoot = new BABYLON.TransformNode("armsRoot", scene);
            meshes.forEach(m => m.parent = armsRoot);
            armsRoot.parent = camera;

            armsRoot.position = new BABYLON.Vector3(0, -0.2, 0.5);
            armsRoot.scaling = new BABYLON.Vector3(2, 2, 2);
            armsRoot.rotation = new BABYLON.Vector3(0, Math.PI, 0);
            console.log("Arms loaded");

            // Apply James texture to arms
            const jamesTexture = new BABYLON.Texture("/textures/James-texture.webp", scene);
            meshes.forEach(mesh => {
                if (mesh.material) {
                    mesh.material.diffuseTexture = jamesTexture;
                }
            });
        },
        null,
        (scene, err) => console.error("Failed to load arms GLB:", err)
    );

    scene.onBeforeRenderObservable.add(() => {
        const forward = camera.getDirection(BABYLON.Axis.Z).normalize();
        const right = camera.getDirection(BABYLON.Axis.X).normalize();

        let moveSpeed = inputMap["shift"] ? shiftSpeed : normalSpeed;
        let move = new BABYLON.Vector3(0,0,0);
        if (inputMap["w"]) move = move.add(forward);
        if (inputMap["s"]) move = move.subtract(forward);
        if (inputMap["a"]) move = move.subtract(right);
        if (inputMap["d"]) move = move.add(right);
        if (move.length() > 0) move = move.normalize().scale(moveSpeed);
        
        // Apply movement
        player.moveWithCollisions(move);
        camera.position = player.position.add(new BABYLON.Vector3(0,0.6,0));

        // Jump/fall - FIXED JUMPING
        if (isJumping) {
            jumpVelocity += gravity;
            player.position.y += jumpVelocity;
            camera.position.y = player.position.y + 0.6;
            
            // Check if we've hit the ground
            if (player.position.y <= 1.0) {
                player.position.y = 1.0;
                camera.position.y = 1.6;
                isJumping = false;
                jumpVelocity = 0;
                canJump = true;
            }
        }
        
        // Jump when space is pressed and not already jumping
        if (inputMap[" "] && canJump && !isJumping) {
            isJumping = true;
            canJump = false;
            jumpVelocity = jumpForce;
        }

        // Squat & animations
        const isMoving = move.length() > 0;
        if (inputMap["shift"]) {
            if (!isSquatting) isSquatting = true;
            camera.position.y = crouchHeight;
            player.position.y = crouchHeight - 0.6;

            if (isMoving) {
                if (squatWalkAnim && !squatWalkAnim.isPlaying) {
                    squatAnim?.stop();
                    squatWalkAnim.start(true);
                }
            } else {
                if (squatAnim && !squatAnim.isPlaying) {
                    squatWalkAnim?.stop();
                    squatAnim.start(true);
                }
            }
        } else {
            if (isSquatting) isSquatting = false;
            camera.position.y = standingHeight;
            player.position.y = standingHeight - 0.6;

            if (standAnim && !standAnim.isPlaying) {
                squatAnim?.stop();
                squatWalkAnim?.stop();
                standAnim.start(true);
            }
        }
    });

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
