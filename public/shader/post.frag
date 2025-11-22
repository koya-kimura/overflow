precision mediump float;

varying vec2 vTexCoord;

uniform float u_beat;
uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_tex;
uniform sampler2D u_uiTex;
uniform sampler2D u_captureTex;

uniform float u_colorPalette[8 * 3];
uniform float u_mosaic;
uniform float u_wave;
uniform float u_invert;

uniform float u_mainOpacity;
uniform float u_bgOpacity;
uniform float u_captureOpacity;
uniform float u_uiOpacity;
uniform float u_masterOpacity;

uniform int u_bgSceneIndex;
uniform int u_bgSceneRotateType;

float PI = 3.14159265358979;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

mat2 rot(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float atan2(float y, float x) {
    return x == 0. ? sign(y) * PI / 2. : atan(y, x);
}

vec2 xy2pol(vec2 xy) {
    return vec2(atan2(xy.y, xy.x), length(xy));
}

vec2 pol2xy(vec2 pol) {
    return pol.y * vec2(cos(pol.x), sin(pol.x));
}

vec2 mosaic(vec2 uv, vec2 res, float n) {
    return vec2((floor(uv.x * n) + 0.5) / n, (floor(uv.y * n * res.y / res.x) + 0.5) / (n * res.y / res.x));
}

float gray(vec3 col) {
    return dot(col, vec3(0.299, 0.587, 0.114));
}

vec3 hsv2rgb(in float h) {
    float s = 1.;
    float v = 1.;

    vec4 K = vec4(1., 2. / 3., 1. / 3., 3.);
    vec3 p = abs(fract(vec3(h) + K.xyz) * 6. - K.w);
    vec3 rgb = v * mix(vec3(K.x), clamp(p - K.x, 0., 1.), s);

    return rgb;
}

float map(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

vec3 index2Color(int index) {
    if(index == 0)
        return vec3(u_colorPalette[0], u_colorPalette[1], u_colorPalette[2]);
    else if(index == 1)
        return vec3(u_colorPalette[3], u_colorPalette[4], u_colorPalette[5]);
    else if(index == 2)
        return vec3(u_colorPalette[6], u_colorPalette[7], u_colorPalette[8]);
    else if(index == 3)
        return vec3(u_colorPalette[9], u_colorPalette[10], u_colorPalette[11]);
    else if(index == 4)
        return vec3(u_colorPalette[12], u_colorPalette[13], u_colorPalette[14]);
    else if(index == 5)
        return vec3(u_colorPalette[15], u_colorPalette[16], u_colorPalette[17]);
    else if(index == 6)
        return vec3(u_colorPalette[18], u_colorPalette[19], u_colorPalette[20]);
    else if(index == 7)
        return vec3(u_colorPalette[21], u_colorPalette[22], u_colorPalette[23]);
    else
        return vec3(0.0);
}

float zigzag(float x) {
    return abs(fract(x * 2.0) - 1.0);
}

vec4 sampleTextureSafe(sampler2D tex, vec2 uv) {
    if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return vec4(0.0);
    }
    return texture2D(tex, uv);
}

void main(void) {
    vec2 uv = vTexCoord;

    if(u_mosaic > 0.0)
        uv = mosaic(uv, u_resolution, map(u_mosaic, 0., 1., 1000., 10.));
    if(u_wave > 0.0)
        uv.x += zigzag(u_beat / 2.) * 0.2 * sin(uv.y * 30.0 + u_beat * PI) * u_wave;

    vec4 col = mix(vec4(0.0), texture2D(u_tex, uv), u_mainOpacity);

    // ==============

    vec4 camcol = vec4(0.0);
    vec2 camuv = vTexCoord;
    camuv = mosaic(camuv, u_resolution, 200.0);
    camcol = sampleTextureSafe(u_captureTex, camuv);
    camcol = vec4(floor(gray(camcol.rgb) * 2.) > .5 ? 1.0 : 0.0);

    if(col.a != 0.0) {
        col.rgb = camcol.a != 0.0 ? col.rgb : mix(col.rgb, vec3(0.0), u_captureOpacity);
    }

    // ==============

    vec2 bguv = vTexCoord;

    bguv -= vec2(.5, .5);
    if(u_bgSceneRotateType == 1) {
        bguv.x *= .8;
        bguv *= rot(u_time * .25);
    } else if(u_bgSceneRotateType == 2) {
        bguv *= rot(PI * .5);
    } else if(u_bgSceneRotateType == 3) {
        bguv *= .1;
    } else if(u_bgSceneRotateType == 4) {
        bguv *= 3.;
        bguv *= rot((floor(vTexCoord.x * 10.) + floor(vTexCoord.y * 10. * u_resolution.y / u_resolution.x)) * PI / 2.);
    }

    bguv += vec2(.5, .5);

    vec4 bgcol = vec4(0.0, 0.0, 0.0, 1.0); // 透明度でマスクされるので悪くないかも

    float lineNum = 20.0;
    float lineWeight = map(pow(zigzag(u_beat / 2.), 2.), 0., 1., 0.01, 0.3);
    int index = (abs(fract(bguv.y * lineNum) - .5) < lineWeight) ? int((random(vec2(floor(bguv.y * lineNum), floor(u_beat * 4.))) - 0.01) * 8.0) : -1;
    bgcol = vec4(index2Color(index), 1.0);

    if(u_bgSceneIndex == 1) {
        for(int i = 0; i < 8; i++) {
            float isMask = map(sin(bguv.x + float(i) * 12.9898 + u_beat), -1., 1., 0., 1.);

            if(abs(bguv.y - isMask) < lineWeight * 0.5) {
                bgcol = vec4(vec3(0.), 1.0);
            }
        }
    }
    if(u_bgSceneIndex == 2) {
        for(int i = 0; i < 8; i++) {
            float isMask = floor(fract(u_time * .25 + float(i) / 8.) * 20.) / 20.;

            if(abs(bguv.x - isMask) < 0.01) {
                bgcol = vec4(vec3(0.), 1.0);
            }
        }
    }

    if(col.a < 0.5)
        col = mix(col, bgcol, u_bgOpacity);
    // if(!(abs((vTexCoord - vec2(.5)).y) < areaHeight && abs((vTexCoord - vec2(.5)).x) < areaHeight * u_resolution.x / u_resolution.y)) col = bgcol;

    // ==============

    if(u_invert > 0.0)
        col.rgb = mix(col.rgb, vec3(1.0) - col.rgb, u_invert);
    if(col.a == 0.0)
        col = vec4(0.0, 0.0, 0.0, 1.0);

    // ==============

    col.rgb *= u_masterOpacity;

    vec4 uicol = texture2D(u_uiTex, vTexCoord);
    uicol *= u_uiOpacity;
    if(uicol.a != 0.0)
        col.rgb = uicol.rgb;

    gl_FragColor = col;
}