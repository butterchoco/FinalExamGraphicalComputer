"use strict";

/*
Created By:
- Ahmad Supriyanto
- Ardanto Finkan Septa
- Ariq Munif
- Muhammad Farras Hakim
- Razaqa Dhafin Haffiyan

References: 
- Array flattening trick from http://stackoverflow.com/questions/10865025/merge-flatten-a-multidimensional-array-in-javascript
- https://www.youtube.com/watch?v=UnFudL21Uq4
- https://webglfundamentals.org/webgl/lessons/webgl-3d-lighting-directional.html
*/
//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
    width, height, border, srcFormat, srcType,
    pixel);

  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
      srcFormat, srcType, image);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn off mips and set
      // wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  image.src = url;

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

function createTextureCoordBuffer(gl, texturecoord) {
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Set Texcoords.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(texturecoord),
    gl.STATIC_DRAW);

  return buffer
}

var Scene = function (gl) {
  this.gl = gl;
  this.shadingMode = gl.TRIANGLES;
  this.wireframe = false;
  this.interactive = false;
  this.spotLightOff = false;
};

Scene.prototype.Load = function (cb) {
  console.log("Loading Scene");

  var me = this;

  /*
  README: Setup all variables here
  */

  // point light position
  me.pointLightPosition = vec3.fromValues(0, 2.0, 1.5);

  // spot light position
  me.spotLightPosition = vec3.fromValues(-17.5, -2, -2);

  // light direction
  me.dirLightDirection = vec3.normalize(
    vec3.create(),
    vec3.fromValues(0.6, 1.0, 0.3)
  );
  me.spotLightDirection = vec3.fromValues(-8, 5, -2);

  // light intensity
  me.pointLightInt = 0.4;
  me.dirLightInt = 0.8;
  me.spotLightInt = 0.8;

  // light color
  me.pointLightColor = vec3.fromValues(1.0, 1.0, 1.0);
  me.spotLightColor = vec3.fromValues(1.0, 1.0, 1.0);
  me.dirLightColor = vec3.fromValues(1.0, 1.0, 0.5);

  // spot light degree
  me.spotLightLimitArea = 360 * Math.PI / 180;

  async.parallel(
    {
      Models: function (callback) {
        async.map(
          {
            RoomModel: "Room.json",
          },
          LoadJSONResource,
          callback
        );
      },
      ShaderCode: function (callback) {
        async.map(
          {
            NoShadow_VSText: "shaders/NoShadow.vs.glsl",
            NoShadow_FSText: "shaders/NoShadow.fs.glsl",
            Shadow_VSText: "shaders/Shadow.vs.glsl",
            Shadow_FSText: "shaders/Shadow.fs.glsl",
            ShadowMapGen_VSText: "shaders/ShadowMapGen.vs.glsl",
            ShadowMapGen_FSText: "shaders/ShadowMapGen.fs.glsl",
          },
          LoadTextResource,
          callback
        );
      },
    },
    function (loadErrors, loadResults) {
      if (loadErrors) {
        cb(loadErrors);
        return;
      }

      //
      // Create Model objects
      //

      me.texture_array = [];
      me.rock_buffer = [0, 0, 0, 0, 0];

      for (
        var i = 0;
        i < loadResults.Models.RoomModel.rootnode.children.length;
        i++
      ) {
        var child = loadResults.Models.RoomModel.rootnode.children[i];
        var mesh = loadResults.Models.RoomModel.meshes[child.meshes];
        switch (child.name) {
          case "LightBulb":
            me.LightMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(4, 4, 4, 1)
            );
            mat4.translate(
              me.LightMesh.world,
              me.LightMesh.world,
              me.pointLightPosition
            );
            break;
          case "SpotLight":
            me.SpotLightMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(4, 4, 4, 1)
            );
            break;
          case "FoundationLight":
            me.FoundationLightMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(4, 4, 4, 1)
            );
            break;
          case "RotorLight":
            me.RotorLightMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(4, 4, 4, 1)
            );
            break;
          case "Room":
            me.WallsMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.3, 0.3, 0.3, 1)
            );
            break;
          case "Chair":
            me.ChairMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.8, 0.6, 0.2, 1)
            );
            // MODIFY texture
            me.textcoords_buffer = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Drone":
            me.DroneMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.DroneMesh["position"] = {
              x: 0,
              y: 0,
              z: 0,
            };
            break;
          case "RotorRDrone":
            me.RotorRDroneMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            break;
          case "RotorLDrone":
            me.RotorLDroneMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            break;
          case "RotorR2Drone":
            me.RotorR2DroneMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            break;
          case "RotorL2Drone":
            me.RotorL2DroneMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            break;
          case "Monster":
            me.MonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.4, 0.4, 0.4, 1)
            );
            me.MonsterMesh["position"] = {
              x: 0,
              y: 0,
              z: 0,
            };
            break;
          case "RightHandMonster":
            me.RightHandMonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.4, 0.4, 0.4, 1)
            );
            break;
          case "LeftHandMonster":
            me.LeftHandMonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.4, 0.4, 0.4, 1)
            );
            break;
          case "LeftLegMonster":
            me.LeftLegMonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.4, 0.4, 0.4, 1)
            );
            break;
          case "RightLegMonster":
            me.RightLegMonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.4, 0.4, 0.4, 1)
            );
            break;
          case "HeadMonster":
            me.HeadMonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.4, 0.4, 0.4, 1)
            );
            break;
          case "EyesMonster":
            me.EyesMonsterMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 0, 0, 1)
            );
            break;
          case "Bike":
            me.BikeMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.8, 0.6, 0.2, 1)
            );
            me.BikeMesh["position"] = {
              x: 0,
              y: 0,
              z: 0,
            };
            break;
          case "FrontWheelBike":
            me.FrontWheelBikeMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.2, 0.2, 0.2, 1)
            );
            break;
          case "RearWheelBike":
            me.RearWheelBikeMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0.2, 0.2, 0.2, 1)
            );
            break;
          case "Tree1":
            me.Tree1Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0, 1, 0, 1)
            );
            break;
          case "Tree2":
            me.Tree2Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0, 1, 0, 1)
            );
            break;
          case "Tree3":
            me.Tree3Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(0, 1, 0, 1)
            );
            mat4.translate(
              me.Tree3Mesh.world,
              me.Tree3Mesh.world,
              vec3.fromValues(-2, 0, 0)
            );
            break;
          case "Rock1":
            me.Rock1Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.rock_buffer[0] = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Rock2":
            me.Rock2Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.rock_buffer[1] = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Rock3":
            me.Rock3Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.rock_buffer[2] = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Rock4":
            me.Rock4Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.rock_buffer[3] = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Rock5":
            me.Rock5Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.rock_buffer[4] = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Rock6":
            me.Rock6Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            break;
          case "Rock7":
            me.Rock7Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            break;
          case "Floor":
            me.FloorMesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1.0, 1.0, 1.0, 1.0)
            );
            me.floor_buffer = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Mountain":
            me.Mountain1Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            // MODIFY texture
            me.mountain_buffer = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Mountain.001":
            me.Mountain2Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.mountain_buffer1 = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
          case "Mountain.002":
            me.Mountain3Mesh = new Model(
              me.gl,
              mesh.vertices,
              [].concat.apply([], mesh.faces),
              mesh.normals,
              vec4.fromValues(1, 1, 1, 1)
            );
            me.mountain_buffer2 = createTextureCoordBuffer(me.gl, mesh.texturecoords[0])
            break;
        }
      }

      if (!me.LightMesh) {
        cb("Failed to load light mesh");
        return;
      }
      if (!me.SpotLightMesh) {
        cb("Failed to load light mesh");
        return;
      }
      if (!me.FoundationLightMesh) {
        cb("Failed to load light mesh");
        return;
      }
      if (!me.RotorLightMesh) {
        cb("Failed to load light mesh");
        return;
      }
      if (!me.WallsMesh) {
        cb("Failed to load walls mesh");
        return;
      }
      if (!me.DroneMesh) {
        cb("Failed to load drone mesh");
        return;
      }
      if (!me.RotorRDroneMesh) {
        cb("Failed to load drone mesh");
        return;
      }
      if (!me.RotorLDroneMesh) {
        cb("Failed to load drone mesh");
        return;
      }
      if (!me.MonsterMesh) {
        cb("Failed to load monster mesh");
        return;
      }
      if (!me.RightHandMonsterMesh) {
        cb("Failed to load monster mesh");
        return;
      }
      if (!me.LeftHandMonsterMesh) {
        cb("Failed to load monster mesh");
        return;
      }
      if (!me.RightLegMonsterMesh) {
        cb("Failed to load monster mesh");
        return;
      }
      if (!me.LeftLegMonsterMesh) {
        cb("Failed to load monster mesh");
        return;
      }
      if (!me.Tree1Mesh) {
        cb("Failed to load tree mesh");
        return;
      }
      if (!me.Tree2Mesh) {
        cb("Failed to load tree mesh");
        return;
      }
      if (!me.Tree3Mesh) {
        cb("Failed to load tree mesh");
        return;
      }
      if (!me.Rock1Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.Rock2Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.Rock3Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.Rock4Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.Rock5Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.Rock6Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.Rock7Mesh) {
        cb("Failed to load rock mesh");
        return;
      }
      if (!me.ChairMesh) {
        cb("Failed to load chair mesh");
        return;
      }
      if (!me.FloorMesh) {
        cb("Failed to load drone mesh");
        return;
      }
      if (!me.Mountain1Mesh) {
        cb("Failed to load mountain mesh");
        return;
      }
      if (!me.Mountain2Mesh) {
        cb("Failed to load mountain mesh");
        return;
      }
      if (!me.Mountain3Mesh) {
        cb("Failed to load mountain mesh");
        return;
      }

      me.BikeMesh.addChild([me.FrontWheelBikeMesh, me.RearWheelBikeMesh]);
      me.HeadMonsterMesh.addChild([me.EyesMonsterMesh]);
      me.MonsterMesh.addChild([
        me.HeadMonsterMesh,
        me.RightLegMonsterMesh,
        me.LeftLegMonsterMesh,
        me.RightHandMonsterMesh,
        me.LeftHandMonsterMesh,
      ]);
      me.DroneMesh.addChild([
        me.RotorLDroneMesh,
        me.RotorL2DroneMesh,
        me.RotorRDroneMesh,
        me.RotorR2DroneMesh,
      ]);

      me.Meshes = [
        me.LightMesh,
        me.WallsMesh,
        me.DroneMesh,
        me.RotorRDroneMesh,
        me.RotorLDroneMesh,
        me.RotorR2DroneMesh,
        me.RotorL2DroneMesh,
        me.MonsterMesh,
        me.RightHandMonsterMesh,
        me.LeftHandMonsterMesh,
        me.RightLegMonsterMesh,
        me.LeftLegMonsterMesh,
        me.HeadMonsterMesh,
        me.EyesMonsterMesh,
        me.BikeMesh,
        me.FrontWheelBikeMesh,
        me.RearWheelBikeMesh,
        me.ChairMesh,
        me.Tree1Mesh,
        me.Tree2Mesh,
        me.Tree3Mesh,
        me.Rock1Mesh,
        me.Rock2Mesh,
        me.Rock3Mesh,
        me.Rock4Mesh,
        me.Rock5Mesh,
        me.Rock6Mesh,
        me.Rock7Mesh,
        me.FloorMesh,
        me.Mountain1Mesh,
        me.Mountain2Mesh,
        me.Mountain3Mesh,
        me.SpotLightMesh,
        me.FoundationLightMesh,
        me.RotorLightMesh
      ];

      //
      // Create Shaders
      //
      me.NoShadowProgram = CreateShaderProgram(
        me.gl,
        loadResults.ShaderCode.NoShadow_VSText,
        loadResults.ShaderCode.NoShadow_FSText
      );
      if (me.NoShadowProgram.error) {
        cb("NoShadowProgram " + me.NoShadowProgram.error);
        return;
      }

      me.ShadowProgram = CreateShaderProgram(
        me.gl,
        loadResults.ShaderCode.Shadow_VSText,
        loadResults.ShaderCode.Shadow_FSText
      );
      if (me.ShadowProgram.error) {
        cb("ShadowProgram " + me.ShadowProgram.error);
        return;
      }

      me.ShadowMapGenProgram = CreateShaderProgram(
        me.gl,
        loadResults.ShaderCode.ShadowMapGen_VSText,
        loadResults.ShaderCode.ShadowMapGen_FSText
      );
      if (me.ShadowMapGenProgram.error) {
        cb("ShadowMapGenProgram " + me.ShadowMapGenProgram.error);
        return;
      }

      me.NoShadowProgram.uniforms = {
        mProj: me.gl.getUniformLocation(me.NoShadowProgram, "mProj"),
        mView: me.gl.getUniformLocation(me.NoShadowProgram, "mView"),
        mWorld: me.gl.getUniformLocation(me.NoShadowProgram, "mWorld"),

        pointLightPosition: me.gl.getUniformLocation(
          me.NoShadowProgram,
          "pointLightPosition"
        ),
        meshColor: me.gl.getUniformLocation(me.NoShadowProgram, "meshColor"),
      };
      me.NoShadowProgram.attribs = {
        vPos: me.gl.getAttribLocation(me.NoShadowProgram, "vPos"),
        vNorm: me.gl.getAttribLocation(me.NoShadowProgram, "vNorm"),
      };

      me.ShadowProgram.uniforms = {
        mProj: me.gl.getUniformLocation(me.ShadowProgram, "mProj"),
        mView: me.gl.getUniformLocation(me.ShadowProgram, "mView"),
        mWorld: me.gl.getUniformLocation(me.ShadowProgram, "mWorld"),

        pointLightPosition: me.gl.getUniformLocation(
          me.ShadowProgram,
          "pointLightPosition"
        ),
        spotLightPosition: me.gl.getUniformLocation(
          me.ShadowProgram,
          "spotLightPosition"
        ),
        dirLightDirection: me.gl.getUniformLocation(
          me.ShadowProgram,
          "dirLightDirection"
        ),
        spotLightDirection: me.gl.getUniformLocation(
          me.ShadowProgram,
          "u_lightDirection"
        ),
        pointLightColor: me.gl.getUniformLocation(
          me.ShadowProgram,
          "pointLightColor"
        ),
        spotLightColor: me.gl.getUniformLocation(
          me.ShadowProgram,
          "spotLightColor"
        ),
        dirLightColor: me.gl.getUniformLocation(
          me.ShadowProgram,
          "dirLightColor"
        ),
        meshColor: me.gl.getUniformLocation(
          me.ShadowProgram,
          "meshColor"
        ),
        lightShadowMap: me.gl.getUniformLocation(
          me.ShadowProgram,
          "lightShadowMap"
        ),
        dirLightShadowMap: me.gl.getUniformLocation(
          me.ShadowProgram,
          "dirLightShadowMap"
        ),
        shadowClipNearFar: me.gl.getUniformLocation(
          me.ShadowProgram,
          "shadowClipNearFar"
        ),
        dirShadowMapView: me.gl.getUniformLocation(
          me.ShadowProgram,
          "dirShadowMapView"
        ),
        pointLightInt: me.gl.getUniformLocation(
          me.ShadowProgram,
          "pointLightBase"
        ),
        spotLightInt: me.gl.getUniformLocation(
          me.ShadowProgram,
          "spotLightBase"
        ),
        dirLightInt: me.gl.getUniformLocation(
          me.ShadowProgram,
          "dirLightBase"
        ),
        bias: me.gl.getUniformLocation(
          me.ShadowProgram,
          "bias"
        ),
        spotLightLimitArea: me.gl.getUniformLocation(
          me.ShadowProgram,
          "u_limit"
        ),
        textureLocation: me.gl.getUniformLocation(
          me.ShadowProgram,
          "u_texture"
        ),
      };

      me.ShadowProgram.attribs = {
        vPos: me.gl.getAttribLocation(me.ShadowProgram, "vPos"),
        vNorm: me.gl.getAttribLocation(me.ShadowProgram, "vNorm"),
        texcoordLocation: me.gl.getAttribLocation(me.ShadowProgram, "a_texcoord"),
      };

      me.ShadowMapGenProgram.uniforms = {
        mProj: me.gl.getUniformLocation(me.ShadowMapGenProgram, "mProj"),
        mView: me.gl.getUniformLocation(me.ShadowMapGenProgram, "mView"),
        mWorld: me.gl.getUniformLocation(me.ShadowMapGenProgram, "mWorld"),

        lightPosition: me.gl.getUniformLocation(
          me.ShadowMapGenProgram,
          "lightPosition"
        ),
        lightDirection: me.gl.getUniformLocation(
          me.ShadowMapGenProgram,
          "lightDirection"
        ),
        shadowClipNearFar: me.gl.getUniformLocation(
          me.ShadowMapGenProgram,
          "shadowClipNearFar"
        ),
      };
      me.ShadowMapGenProgram.attribs = {
        vPos: me.gl.getAttribLocation(me.ShadowMapGenProgram, "vPos"),
      };


      // texture parameters
      me.floatExtension = me.gl.getExtension("OES_texture_float");
      me.floatLinearExtension = me.gl.getExtension("OES_texture_float_linear");

      // directional light shadow map texture
      me.dirLightShadowMap = me.gl.createTexture();
      me.gl.bindTexture(me.gl.TEXTURE_2D, me.dirLightShadowMap);
      me.gl.texParameteri(
        me.gl.TEXTURE_2D,
        me.gl.TEXTURE_MIN_FILTER,
        me.gl.LINEAR
      );
      me.gl.texParameteri(
        me.gl.TEXTURE_2D,
        me.gl.TEXTURE_MAG_FILTER,
        me.gl.LINEAR
      );
      me.gl.texParameteri(
        me.gl.TEXTURE_2D,
        me.gl.TEXTURE_WRAP_S,
        me.gl.MIRRORED_REPEAT
      );
      me.gl.texParameteri(
        me.gl.TEXTURE_2D,
        me.gl.TEXTURE_WRAP_T,
        me.gl.MIRRORED_REPEAT
      );

      if (me.floatExtension && me.floatLinearExtension) {
        me.gl.texImage2D(
          me.gl.TEXTURE_2D,
          0,
          me.gl.RGBA,
          me.textureSize,
          me.textureSize,
          0,
          me.gl.RGBA,
          me.gl.FLOAT,
          null
        );
      } else {
        me.gl.texImage2D(
          me.gl.TEXTURE_2D,
          0,
          me.gl.RGBA,
          me.textureSize,
          me.textureSize,
          0,
          me.gl.RGBA,
          me.gl.UNSIGNED_BYTE,
          null
        );
      }

      me.gl.bindTexture(me.gl.TEXTURE_2D, null);

      // point light shadow cubemap texture
      me.shadowMapCube = me.gl.createTexture();
      me.gl.bindTexture(me.gl.TEXTURE_CUBE_MAP, me.shadowMapCube);
      me.gl.texParameteri(
        me.gl.TEXTURE_CUBE_MAP,
        me.gl.TEXTURE_MIN_FILTER,
        me.gl.LINEAR
      );
      me.gl.texParameteri(
        me.gl.TEXTURE_CUBE_MAP,
        me.gl.TEXTURE_MAG_FILTER,
        me.gl.LINEAR
      );
      me.gl.texParameteri(
        me.gl.TEXTURE_CUBE_MAP,
        me.gl.TEXTURE_WRAP_S,
        me.gl.MIRRORED_REPEAT
      );
      me.gl.texParameteri(
        me.gl.TEXTURE_CUBE_MAP,
        me.gl.TEXTURE_WRAP_T,
        me.gl.MIRRORED_REPEAT
      );
      if (me.floatExtension && me.floatLinearExtension) {
        for (var i = 0; i < 6; i++) {
          me.gl.texImage2D(
            me.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            0,
            me.gl.RGBA,
            me.textureSize,
            me.textureSize,
            0,
            me.gl.RGBA,
            me.gl.FLOAT,
            null
          );
        }
      } else {
        for (var i = 0; i < 6; i++) {
          me.gl.texImage2D(
            me.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            0,
            me.gl.RGBA,
            me.textureSize,
            me.textureSize,
            0,
            me.gl.RGBA,
            me.gl.UNSIGNED_BYTE,
            null
          );
        }
      }

      me.shadowMapFramebuffer = me.gl.createFramebuffer();
      me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, me.shadowMapFramebuffer);

      me.shadowMapRenderbuffer = me.gl.createRenderbuffer();
      me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, me.shadowMapRenderbuffer);
      me.gl.renderbufferStorage(
        me.gl.RENDERBUFFER,
        me.gl.DEPTH_COMPONENT16,
        me.textureSize,
        me.textureSize
      );

      me.gl.bindTexture(me.gl.TEXTURE_CUBE_MAP, null);
      me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, null);
      me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, null);

      // BEGIN LOAD IMAGE
      // Create a texture.
      me.brick_texture = loadTexture(me.gl, 'bricks.png')
      me.grass_texture = loadTexture(me.gl, 'grass2.jpg')
      me.gravel_texture = loadTexture(me.gl, 'gravel.jpg')
      me.rock_texture = loadTexture(me.gl, 'rock.jpg')
      me.land_texture = loadTexture(me.gl, 'land.png')


      me.gl.bindTexture(me.gl.TEXTURE_CUBE_MAP, null);
      me.gl.bindRenderbuffer(me.gl.RENDERBUFFER, null);
      me.gl.bindFramebuffer(me.gl.FRAMEBUFFER, null);



      // at init time make a 1x1 white texture.
      me.white_texture = me.gl.createTexture();
      me.gl.bindTexture(me.gl.TEXTURE_2D, me.white_texture);
      me.gl.texImage2D(me.gl.TEXTURE_2D, 0, me.gl.RGBA, 1, 1, 0, me.gl.RGBA, me.gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255]));

      // END LOAD IMAGE

      //
      // Logical Values
      //
      me.camera = new Camera(
        vec3.fromValues(0, 2, 6),
        vec3.fromValues(0, 1, 0),
        vec3.fromValues(0, 0, -1)
      );

      me.projMatrix = mat4.create();
      me.viewMatrix = mat4.create();

      mat4.perspective(
        me.projMatrix,
        glMatrix.toRadian(90),
        me.gl.canvas.width / me.gl.canvas.height,
        0.35,
        85.0
      );

      // point light shadow cubemap projection
      me.shadowMapCameras = [
        // Positive X
        new Camera(
          me.pointLightPosition,
          vec3.add(
            vec3.create(),
            me.pointLightPosition,
            vec3.fromValues(1, 0, 0)
          ),
          vec3.fromValues(0, -1, 0)
        ),
        // Negative X
        new Camera(
          me.pointLightPosition,
          vec3.add(
            vec3.create(),
            me.pointLightPosition,
            vec3.fromValues(-1, 0, 0)
          ),
          vec3.fromValues(0, -1, 0)
        ),
        // Positive Y
        new Camera(
          me.pointLightPosition,
          vec3.add(
            vec3.create(),
            me.pointLightPosition,
            vec3.fromValues(0, 1, 0)
          ),
          vec3.fromValues(0, 0, 1)
        ),
        // Negative Y
        new Camera(
          me.pointLightPosition,
          vec3.add(
            vec3.create(),
            me.pointLightPosition,
            vec3.fromValues(0, -1, 0)
          ),
          vec3.fromValues(0, 0, -1)
        ),
        // Positive Z
        new Camera(
          me.pointLightPosition,
          vec3.add(
            vec3.create(),
            me.pointLightPosition,
            vec3.fromValues(0, 0, 1)
          ),
          vec3.fromValues(0, -1, 0)
        ),
        // Negative Z
        new Camera(
          me.pointLightPosition,
          vec3.add(
            vec3.create(),
            me.pointLightPosition,
            vec3.fromValues(0, 0, -1)
          ),
          vec3.fromValues(0, -1, 0)
        ),
      ];
      me.shadowMapViewMatrices = [
        mat4.create(),
        mat4.create(),
        mat4.create(),
        mat4.create(),
        mat4.create(),
        mat4.create(),
      ];
      me.shadowMapProj = mat4.create();
      me.shadowClipNearFar = vec2.fromValues(0.05, 15.0);
      mat4.perspective(
        me.shadowMapProj,
        glMatrix.toRadian(90),
        1.0,
        me.shadowClipNearFar[0],
        me.shadowClipNearFar[1]
      );

      // directional light shadow map projection
      me.dirShadowMapCam = new Camera(
        vec3.create(),
        me.dirLightDirection,
        vec3.fromValues(0, 1, 0)
      );
      me.dirShadowMapClip = vec2.fromValues(-20.0, 20.0);
      me.dirShadowMapProj = mat4.ortho(
        mat4.create(),
        me.dirShadowMapClip[0],
        me.dirShadowMapClip[1],
        me.dirShadowMapClip[0],
        me.dirShadowMapClip[1],
        me.dirShadowMapClip[0],
        me.dirShadowMapClip[1]
      );
      me.dirShadowMapView = mat4.create();

      cb();
    }
  );

  me.PressedKeys = {
    Up: false,
    Right: false,
    Down: false,
    Left: false,
    Forward: false,
    Back: false,

    RotLeft: false,
    RotRight: false,
  };

  me.MoveForwardSpeed = 3.5;
  me.RotateSpeed = 1.5;
  me.textureSize = getParameterByName("texSize") || 512;

  me.lightDisplacementInputAngle = 0.0;
};

Scene.prototype.Unload = function () {
  this.LightMesh = null;
  this.WallsMesh = null;
  this.DroneMesh = null;
  this.RotorRDroneMesh = null;
  this.RotorLDroneMesh = null;
  this.RotorR2DroneMesh = null;
  this.RotorL2DroneMesh = null;
  this.MonsterMesh = null;
  this.RightHandMonsterMesh = null;
  this.LeftHandMonsterMesh = null;
  this.RightLegMonsterMesh = null;
  this.LeftLegMonsterMesh = null;
  this.HeadMonsterMesh = null;
  this.EyesMonsterMesh = null;
  this.BikeMesh = null;
  this.FrontWheelBikeMesh = null;
  this.RearWheelBikeMesh = null;
  this.ChairMesh = null;
  this.Tree1Mesh = null;
  this.Tree2Mesh = null;
  this.Tree3Mesh = null;
  this.Rock1Mesh = null;
  this.Rock2Mesh = null;
  this.Rock3Mesh = null;
  this.Rock4Mesh = null;
  this.Rock5Mesh = null;
  this.Rock6Mesh = null;
  this.Rock7Mesh = null;
  this.FloorMesh = null;
  this.Mountain1Mesh = null;
  this.Mountain2Mesh = null;
  this.Mountain3Mesh = null;

  this.NoShadowProgram = null;
  this.ShadowProgram = null;
  this.ShadowMapGenProgram = null;

  this.camera = null;
  this.pointLightPosition = null;
  this.spotLightPosition = null;

  this.dirLightDirection = null;
  this.spotLightDirection = null;

  this.pointLightInt = null;
  this.spotLightInt = null;
  this.dirLightInt = null;

  this.pointLightColor = null;
  this.spotLightColor = null;
  this.dirLightColor = null;

  this.Meshes = null;

  this.PressedKeys = null;

  this.MoveForwardSpeed = null;
  this.RotateSpeed = null;

  this.shadowMapCube = null;
  this.textureSize = null;

  this.spotLightLimitArea = null;

  this.shadowMapCameras = null;
  this.shadowMapViewMatrices = null;
  this.brick_texture = null;
  this.white_texture = null;
};

Scene.prototype.Begin = function () {
  console.log("Beginning Scene");

  var me = this;

  const changeShadingModeBtn = document.getElementById("changeShadingMode");
  const changeInteractiveModeBtn = document.getElementById(
    "changeInteractiveMode"
  );
  const changeLightModeBtn = document.getElementById(
    "changeLightMode"
  );

  // Attach event listeners
  this.__ResizeWindowListener = this._OnResizeWindow.bind(this);
  this.__KeyDownWindowListener = this._OnKeyDown.bind(this);
  this.__KeyUpWindowListener = this._OnKeyUp.bind(this);
  this.__ModeClickListener = this._OnClick.bind(this);

  AddEvent(window, "resize", this.__ResizeWindowListener);
  AddEvent(window, "keydown", this.__KeyDownWindowListener);
  AddEvent(window, "keyup", this.__KeyUpWindowListener);
  AddEvent(changeShadingModeBtn, "click", this.__ModeClickListener);
  AddEvent(changeInteractiveModeBtn, "click", this.__ModeClickListener);
  AddEvent(changeLightModeBtn, "click", this.__ModeClickListener);

  // Render Loop
  var previousFrame = performance.now();
  var dt = 0;
  var loop = function (currentFrameTime) {
    dt = currentFrameTime - previousFrame;
    me._Update(dt);
    previousFrame = currentFrameTime;

    me._Generate2DShadowMap();
    me._GenerateShadowMap();
    me._Render();
    me.nextFrameHandle = requestAnimationFrame(loop);
  };

  me.nextFrameHandle = requestAnimationFrame(loop);

  me._OnResizeWindow();
};

Scene.prototype.End = function () {
  if (this.__ResizeWindowListener) {
    RemoveEvent(window, "resize", this.__ResizeWindowListener);
  }
  if (this.__KeyUpWindowListener) {
    RemoveEvent(window, "keyup", this.__KeyUpWindowListener);
  }
  if (this.__KeyDownWindowListener) {
    RemoveEvent(window, "keydown", this.__KeyDownWindowListener);
  }

  if (this.nextFrameHandle) {
    cancelAnimationFrame(this.nextFrameHandle);
  }
};

//
// Private Methods
//

Scene.prototype._Update = function (dt) {
  if (this.PressedKeys.Forward && !this.PressedKeys.Back) {
    this.camera.moveForward((dt / 1000) * this.MoveForwardSpeed);
    this.camera.moveUp((dt / 6000) * this.MoveForwardSpeed);
    if (this.interactive) {
      this.DroneMesh.position.x = 0;
      this.DroneMesh.position.z = 0.0475;
    }
  }

  if (this.PressedKeys.Back && !this.PressedKeys.Forward) {
    this.camera.moveForward((-dt / 1000) * this.MoveForwardSpeed);
    this.camera.moveUp((-dt / 6000) * this.MoveForwardSpeed);
    if (this.interactive) {
      this.DroneMesh.position.x = 0;
      this.DroneMesh.position.z = -0.0475;
    }
  }

  if (this.PressedKeys.Right && !this.PressedKeys.Left) {
    this.camera.moveRight((dt / 1000) * this.MoveForwardSpeed);
    if (this.interactive) {
      this.DroneMesh.position.x = -0.0475;
    }
  }

  if (this.PressedKeys.Left && !this.PressedKeys.Right) {
    this.camera.moveRight((-dt / 1000) * this.MoveForwardSpeed);
    if (this.interactive) {
      this.DroneMesh.position.x = 0.0475;
    }
  }

  if (this.PressedKeys.Up && !this.PressedKeys.Down) {
    this.camera.moveUp((dt / 1000) * this.MoveForwardSpeed);
    if (this.interactive) {
      this.DroneMesh.position.y = 0;
      this.DroneMesh.position.y += 0.0475;
    }
  }

  if (this.PressedKeys.Down && !this.PressedKeys.Up) {
    this.camera.moveUp((-dt / 1000) * this.MoveForwardSpeed);
    if (this.interactive) {
      this.DroneMesh.position.y = 0;
      this.DroneMesh.position.y -= 0.0475;
    }
  }

  if (this.PressedKeys.RotRight && !this.PressedKeys.RotLeft) {
    this.camera.rotateRight((-dt / 1000) * this.RotateSpeed);
  }

  if (this.PressedKeys.RotLeft && !this.PressedKeys.RotRight) {
    this.camera.rotateRight((dt / 1000) * this.RotateSpeed);
  }

  if (this.PressedKeys.RotUp && !this.PressedKeys.RotDown) {
    this.camera.rotateUp((dt / 1000) * this.RotateSpeed);
  }

  if (this.PressedKeys.RotDown && !this.PressedKeys.RotUp) {
    this.camera.rotateUp((-dt / 1000) * this.RotateSpeed);
  }

  if (this.wireframe) {
    document.querySelector("#shadingMode").innerHTML = "wireframe";
    this.shadingMode = this.gl.LINES;
  } else {
    document.querySelector("#shadingMode").innerHTML = "shading";
    this.shadingMode = this.gl.TRIANGLES;
  }

  if (this.spotLightOff) {
    document.querySelector("#lightMode").innerHTML = "off";
  } else {
    document.querySelector("#lightMode").innerHTML = "on";
  }

  // Change __update in Demo Mode

  // Change __update in Interactive Mode
  if (this.interactive) {
    if (
      !this.PressedKeys.Forward &&
      !this.PressedKeys.Back &&
      !this.PressedKeys.Right &&
      !this.PressedKeys.Left &&
      !this.PressedKeys.Down &&
      !this.PressedKeys.Up
    ) {
      this.DroneMesh.position.x = 0;
      this.DroneMesh.position.y = 0;
      this.DroneMesh.position.z = 0;
    }
    this.DroneMesh.translate(
      vec3.fromValues(
        this.DroneMesh.position.x,
        this.DroneMesh.position.y,
        this.DroneMesh.position.z
      )
    );
    document.querySelector("#interactiveMode").innerHTML = "interactive";
  } else {
    this.RotorLDroneMesh.translate(vec3.fromValues(0.01943, 0, 0.01));
    this.RotorRDroneMesh.translate(vec3.fromValues(0.01943, 0, -0.01));
    this.RotorLDroneMesh.rotateY((dt / 6000) * this.MoveForwardSpeed);
    this.RotorRDroneMesh.rotateY((dt / 6000) * this.MoveForwardSpeed);

    this.HeadMonsterMesh.translate(vec3.fromValues(0.01999, 0, 0.01));
    this.HeadMonsterMesh.rotateY((dt / 6000) * this.MoveForwardSpeed);
    this.DroneMesh.position = {
      x: 0,
      y: 0,
      z: 0,
    };
    document.querySelector("#interactiveMode").innerHTML = "Demo";
  }

  this.lightDisplacementInputAngle += dt / 2337;
  var xDisplacement = Math.sin(this.lightDisplacementInputAngle) * 2.8;

  this.LightMesh.world[12] = xDisplacement;
  for (var i = 0; i < this.shadowMapCameras.length; i++) {
    mat4.getTranslation(
      this.shadowMapCameras[i].position,
      this.LightMesh.world
    );
    this.shadowMapCameras[i].GetViewMatrix(this.shadowMapViewMatrices[i]);
  }

  this.camera.GetViewMatrix(this.viewMatrix);
};

Scene.prototype._Generate2DShadowMap = function () {
  var gl = this.gl;

  // Set GL state status
  gl.useProgram(this.ShadowMapGenProgram);
  gl.bindTexture(gl.TEXTURE_2D, this.dirLightShadowMap);
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFramebuffer);
  gl.bindRenderbuffer(gl.RENDERBUFFER, this.shadowMapRenderbuffer);

  gl.viewport(0, 0, this.textureSize, this.textureSize);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  // Set per-frame uniforms
  gl.uniform2fv(
    this.ShadowMapGenProgram.uniforms.shadowClipNearFar,
    this.dirShadowMapClip
  );
  gl.uniform3fv(this.ShadowMapGenProgram.uniforms.lightPosition, vec3.create());
  gl.uniform3fv(
    this.ShadowMapGenProgram.uniforms.lightDirection,
    this.dirLightDirection
  );
  gl.uniformMatrix4fv(
    this.ShadowMapGenProgram.uniforms.mProj,
    gl.FALSE,
    this.dirShadowMapProj
  );

  // Set per light uniforms
  gl.uniformMatrix4fv(
    this.ShadowMapGenProgram.uniforms.mView,
    gl.FALSE,
    this.dirShadowMapCam.GetViewMatrix(this.dirShadowMapView)
  );

  // Set framebuffer destination
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    this.dirLightShadowMap,
    0
  );
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    this.shadowMapRenderbuffer
  );

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw meshes
  for (var j = 0; j < this.Meshes.length; j++) {
    // Per object uniforms
    gl.uniformMatrix4fv(
      this.ShadowMapGenProgram.uniforms.mWorld,
      gl.FALSE,
      this.Meshes[j].world
    );

    // Set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[j].vbo);
    gl.vertexAttribPointer(
      this.ShadowMapGenProgram.attribs.vPos,
      3,
      gl.FLOAT,
      gl.FALSE,
      0,
      0
    );
    gl.enableVertexAttribArray(this.ShadowMapGenProgram.attribs.vPos);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.Meshes[j].ibo);
    gl.drawElements(
      this.shadingMode,
      this.Meshes[j].nPoints,
      gl.UNSIGNED_SHORT,
      0
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
};

Scene.prototype._GenerateShadowMap = function () {
  var gl = this.gl;

  // Set GL state status
  gl.useProgram(this.ShadowMapGenProgram);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFramebuffer);
  gl.bindRenderbuffer(gl.RENDERBUFFER, this.shadowMapRenderbuffer);

  gl.viewport(0, 0, this.textureSize, this.textureSize);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  // Set per-frame uniforms
  gl.uniform2fv(
    this.ShadowMapGenProgram.uniforms.shadowClipNearFar,
    this.shadowClipNearFar
  );
  gl.uniform3fv(
    this.ShadowMapGenProgram.uniforms.lightPosition,
    this.pointLightPosition
  );
  gl.uniform3fv(
    this.ShadowMapGenProgram.uniforms.lightDirection,
    vec3.create()
  );
  gl.uniformMatrix4fv(
    this.ShadowMapGenProgram.uniforms.mProj,
    gl.FALSE,
    this.shadowMapProj
  );

  for (var i = 0; i < this.shadowMapCameras.length; i++) {
    // Set per light uniforms
    gl.uniformMatrix4fv(
      this.ShadowMapGenProgram.uniforms.mView,
      gl.FALSE,
      this.shadowMapCameras[i].GetViewMatrix(this.shadowMapViewMatrices[i])
    );

    // Set framebuffer destination
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
      this.shadowMapCube,
      0
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      this.shadowMapRenderbuffer
    );

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw meshes
    for (var j = 0; j < this.Meshes.length; j++) {
      // Per object uniforms
      gl.uniformMatrix4fv(
        this.ShadowMapGenProgram.uniforms.mWorld,
        gl.FALSE,
        this.Meshes[j].world
      );

      // Set attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[j].vbo);
      gl.vertexAttribPointer(
        this.ShadowMapGenProgram.attribs.vPos,
        3,
        gl.FLOAT,
        gl.FALSE,
        0,
        0
      );
      gl.enableVertexAttribArray(this.ShadowMapGenProgram.attribs.vPos);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.Meshes[j].ibo);
      gl.drawElements(
        this.shadingMode,
        this.Meshes[j].nPoints,
        gl.UNSIGNED_SHORT,
        0
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
};

Scene.prototype._Render = function () {
  var gl = this.gl;

  // Clear back buffer, set per-frame uniforms
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

  gl.useProgram(this.ShadowProgram);
  gl.uniformMatrix4fv(
    this.ShadowProgram.uniforms.mProj,
    gl.FALSE,
    this.projMatrix
  );
  gl.uniformMatrix4fv(
    this.ShadowProgram.uniforms.mView,
    gl.FALSE,
    this.viewMatrix
  );
  gl.uniformMatrix4fv(
    this.ShadowProgram.uniforms.dirShadowMapView,
    gl.FALSE,
    this.dirShadowMapView
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.pointLightPosition,
    this.pointLightPosition
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.spotLightPosition,
    this.spotLightPosition
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.dirLightDirection,
    this.dirLightDirection
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.spotLightDirection,
    this.spotLightDirection
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.pointLightColor,
    this.pointLightColor
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.spotLightColor,
    this.spotLightColor
  );
  gl.uniform3fv(
    this.ShadowProgram.uniforms.dirLightColor,
    this.dirLightColor
  );
  gl.uniform1f(
    this.ShadowProgram.uniforms.spotLightLimitArea,
    this.spotLightLimitArea
  );
  gl.uniform2fv(
    this.ShadowProgram.uniforms.shadowClipNearFar,
    this.shadowClipNearFar
  );
  gl.uniform1f(this.ShadowProgram.uniforms.pointLightInt, this.pointLightInt);
  gl.uniform1f(this.ShadowProgram.uniforms.dirLightInt, this.dirLightInt);
  gl.uniform1f(this.ShadowProgram.uniforms.spotLightInt, this.spotLightInt);
  if (this.floatExtension && this.floatLinearExtension) {
    gl.uniform1f(this.ShadowProgram.uniforms.bias, 0.0001);
  } else {
    gl.uniform1f(this.ShadowProgram.uniforms.bias, 0.003);
  }
  gl.uniform1i(this.ShadowProgram.uniforms.lightShadowMap, 0);
  gl.uniform1i(this.ShadowProgram.uniforms.dirLightShadowMap, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.shadowMapCube);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, this.dirLightShadowMap);

  // MODIFY

  gl.uniform1i(this.ShadowProgram.uniforms.textureLocation, 2);


  gl.activeTexture(gl.TEXTURE2);
  // Bind the texture to texture unit 2
  gl.bindTexture(gl.TEXTURE_2D, this.brick_texture);
  // Tell the shader to use texture unit 0 for u_texture
  // END MODIFY
  var coord_selected = null;
  var texture_selected = null;
  var with_texture = null;
  // Draw meshes
  for (var i = 0; i < this.Meshes.length; i++) {
    // Per object uniforms
    gl.uniformMatrix4fv(
      this.ShadowProgram.uniforms.mWorld,
      gl.FALSE,
      this.Meshes[i].world
    );
    with_texture = true

    if (i == 17) {
      texture_selected = this.brick_texture
      coord_selected = this.textcoords_buffer
    } else if (i >= 21 && i <= 25) {
      texture_selected = this.rock_texture
      coord_selected = this.rock_buffer[i - 21]
    } else if (i == 28) {
      texture_selected = this.land_texture
      coord_selected = this.floor_buffer
    } else if (i == 29) {
      texture_selected = this.grass_texture
      coord_selected = this.mountain_buffer
    } else if (i == 30) {
      texture_selected = this.grass_texture
      coord_selected = this.mountain_buffer1
    } else if (i == 31) {
      texture_selected = this.grass_texture
      coord_selected = this.mountain_buffer2
    } else {
      with_texture = false;
    }

    // MODIFY
    if (with_texture) {
      gl.uniform4fv(this.ShadowProgram.uniforms.meshColor, new Float32Array([1, 1, 1, 1]));

      gl.activeTexture(gl.TEXTURE2);
      // Bind the texture to texture unit 2
      gl.bindTexture(gl.TEXTURE_2D, texture_selected);
      // Tell the shader to use texture unit 0 for u_texture
      // END MODIFY
    } else {
      gl.uniform4fv(this.ShadowProgram.uniforms.meshColor, this.Meshes[i].color);

      gl.activeTexture(gl.TEXTURE2);
      // Bind the texture to texture unit 2
      gl.bindTexture(gl.TEXTURE_2D, this.white_texture);
      // Tell the shader to use texture unit 0 for u_texture
      // END MODIFY
    }


    if (with_texture) {
      // MODIFY
      // bind the texcoord buffer.
      gl.bindBuffer(gl.ARRAY_BUFFER, coord_selected);

      // Tell the texcoord attribute how to get data out of texcoordBuffer (ARRAY_BUFFER)
      var size = 2;          // 1 components per iteration
      var type = gl.FLOAT;   // the data is 32bit floats
      var normalize = gl.FALSE; // don't normalize the data
      var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
      var offset = 0;        // start at the beginning of the buffer
      gl.vertexAttribPointer(
        this.ShadowProgram.attribs.texcoordLocation, size, type, normalize, stride, offset);

      // Turn on the texcoord attribute
      gl.enableVertexAttribArray(this.ShadowProgram.attribs.texcoordLocation);
      // END MODIFY
    } else {
      //  gl.disableVertexAttribArray(this.ShadowProgram.attribs.texcoordLocation);
    }


    // Set attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[i].vbo);
    gl.vertexAttribPointer(
      this.ShadowProgram.attribs.vPos,
      3,
      gl.FLOAT,
      gl.FALSE,
      0,
      0
    );

    gl.enableVertexAttribArray(this.ShadowProgram.attribs.vPos);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.Meshes[i].nbo);
    gl.vertexAttribPointer(
      this.ShadowProgram.attribs.vNorm,
      3,
      gl.FLOAT,
      gl.FALSE,
      0,
      0
    );
    gl.enableVertexAttribArray(this.ShadowProgram.attribs.vNorm);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.Meshes[i].ibo);

    gl.drawElements(
      this.shadingMode,
      this.Meshes[i].nPoints,
      gl.UNSIGNED_SHORT,
      0
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
};

//
// Event Listeners
//
Scene.prototype._OnResizeWindow = function () {
  var gl = this.gl;

  var targetHeight = (window.innerWidth * 9) / 16;

  if (window.innerHeight > targetHeight) {
    // Center vertically
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = targetHeight;
    gl.canvas.style.left = "0";
    gl.canvas.style.top = (window.innerHeight - targetHeight) / 2 + "px";
  } else {
    // Center horizontally
    gl.canvas.width = (window.innerHeight * 16) / 9;
    gl.canvas.height = window.innerHeight;
    gl.canvas.style.left = (window.innerWidth - gl.canvas.width) / 2 + "px";
    gl.canvas.style.top = "0";
  }

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
};

Scene.prototype._OnKeyDown = function (e) {
  switch (e.code) {
    case "KeyW":
      this.PressedKeys.Forward = true;
      break;
    case "KeyA":
      this.PressedKeys.Left = true;
      break;
    case "KeyD":
      this.PressedKeys.Right = true;
      break;
    case "KeyS":
      this.PressedKeys.Back = true;
      break;
    case "Space":
      this.PressedKeys.Up = true;
      break;
    case "ShiftLeft":
      this.PressedKeys.Down = true;
      break;
    case "ArrowUp":
      this.PressedKeys.RotUp = true;
      break;
    case "ArrowDown":
      this.PressedKeys.RotDown = true;
      break;
    case "ArrowRight":
      this.PressedKeys.RotRight = true;
      break;
    case "ArrowLeft":
      this.PressedKeys.RotLeft = true;
      break;
  }
};

Scene.prototype._OnKeyUp = function (e) {
  switch (e.code) {
    case "KeyW":
      this.PressedKeys.Forward = false;
      break;
    case "KeyA":
      this.PressedKeys.Left = false;
      break;
    case "KeyD":
      this.PressedKeys.Right = false;
      break;
    case "KeyS":
      this.PressedKeys.Back = false;
      break;
    case "Space":
      this.PressedKeys.Up = false;
      break;
    case "ShiftLeft":
      this.PressedKeys.Down = false;
      break;
    case "ArrowUp":
      this.PressedKeys.RotUp = false;
      break;
    case "ArrowDown":
      this.PressedKeys.RotDown = false;
      break;
    case "ArrowRight":
      this.PressedKeys.RotRight = false;
      break;
    case "ArrowLeft":
      this.PressedKeys.RotLeft = false;
      break;
  }
};

Scene.prototype._OnClick = function (e) {
  switch (e.target.id) {
    case "changeShadingMode":
      this.wireframe = !this.wireframe;
      break;
    case "changeLightMode":
      this.spotLightOff = !this.spotLightOff;
      if (this.spotLightOff) {
        this.spotLightInt = 0.0;
      } else {
        this.spotLightInt = 0.8;
      }
      break;
    case "changeInteractiveMode":
      this.interactive = !this.interactive;
      if (this.interactive) {
        this.DroneMesh.fromRotation(180, vec3.fromValues(0, 1, 0));
        this.DroneMesh.position = {
          x: 0,
          y: 0,
          z: 0,
        };

        this.camera.position = [0.1, 3, 4];
        this.DroneMesh.translate(vec3.fromValues(0, 0, 0));
      } else {
        this.DroneMesh.fromRotation(0, vec3.fromValues(0, 1, 0));
        this.DroneMesh.position = {
          x: 0,
          y: 0,
          z: 0,
        };
      }
  }
};
