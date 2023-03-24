window.onload = document.onchange = function () {
    switch (getValueOfRatio("f-type")) {
        case "std":
            Array.from(document.getElementsByClassName("std")).forEach(span => {
                span.style.cssText += "display: block"
            })
            Array.from(document.getElementsByClassName("slt")).forEach(span => {
                span.style.cssText += "display: none"
            })
            break
        case "slt":
            Array.from(document.getElementsByClassName("std")).forEach(span => {
                span.style.cssText += "display: none"
            })
            Array.from(document.getElementsByClassName("slt")).forEach(span => {
                span.style.cssText += "display: block"
            })
            break
    }
}

document.querySelector("#gene").onclick = function () {
    switch (getValueOfRatio("f-type")) {
        case "std":
            var str = generateSTDFrame(
                getValueOfRatio("f-type"),
                {
                    "pic": routeDealing(document.querySelector("#f-bgi")),
                    "music": routeDealing(document.querySelector("#f-bgm")),
                    "effect": document.querySelector("#f-bge").value
                },
                {
                    "pic": routeDealing(document.querySelector("#f-role-l-p")),
                    "vocal": routeDealing(document.querySelector("#f-role-l-v")),
                    "effect": document.querySelector("#f-role-l-e").value
                },
                {
                    "pic": routeDealing(document.querySelector("#f-role-r-p")),
                    "vocal": routeDealing(document.querySelector("#f-role-r-v")),
                    "effect": document.querySelector("#f-role-r-e").value
                },
                {
                    "speaker": document.querySelector("#f-text-spaeker").value,
                    "body": document.querySelector("#f-text-body").value
                },
                routeDealing(document.querySelector("#f-se")),
                getValueOfCheckbox("f-iff"))
            break
        case "slt":
            let opArr = [];
            for (let i = 0; i < 3; i++) {
                const op = document.getElementsByClassName("name")[i].value
                const opr = document.getElementsByClassName("operation")[i].value
                if (op && opr)
                    opArr.push({ "name": op, "operation": opr })
            }
            var str = generateSLTFrame(
                getValueOfRatio("f-type"),
                opArr,
                getValueOfCheckbox("f-iff")
            )
            break
    }
    document.querySelector("#result").innerHTML = str
}

function getValueOfRatio(name) {
    let value;
    Array.from(document.getElementsByName(name)).forEach(e => {
        if (e.checked)
            value = e.value
    })
    return value
}

function getValueOfCheckbox(id) {
    let value = false;
    if (document.querySelector("#" + id).checked)
        value = true
    return value
}

function routeDealing(e) {
    let value = e.value ? e.value : ""
    if (value.includes("\\") || value.includes("/")) {
        let vP1 = value.split("\\")
        value = vP1[vP1.length - 1]
        let vP2 = value.split("/")
        value = vP2[vP2.length - 1]
    }
    return value
}

/**
 * 生成标准帧描述字符串。
*/
function generateSTDFrame(type, bg, roleL, roleR, text, soundEffect, isFinalFrame) {
    return `{
    "type": "`+ type + `",
    "bg": {
        "pic": `+ (bg.pic ? `url("media/graph/` + bg.pic + `")` : `null`) + `,
        "music": `+ (bg.music ? `url("media/music/` + bg.music + `")` : `null`) + `,
        "effect": `+ (bg.effect ? `"` + bg.effect + `"` : `null`) + `
    },
    "roleL": {
        "pic": `+ (roleL.pic ? `url("media/graph/` + roleL.pic + `")` : `null`) + `,
        "vocal": `+ (roleL.vocal ? `url("media/vocal/` + roleL.vocal + `")` : `null`) + `,
        "effect": `+ (roleL.effect ? `"` + roleL.effect + `"` : `null`) + `
    },
    "roleR": {
        "pic": `+ (roleR.pic ? `url("media/graph/` + roleR.pic + `")` : `null`) + `,
        "vocal": `+ (roleR.vocal ? `url("media/vocal/` + roleR.vocal + `")` : `null`) + `,
        "effect": `+ (roleR.effect ? `"` + roleR.effect + `"` : `null`) + `
    },
    "text": {
        "speaker": `+ (text.speaker ? `"` + text.speaker + `"` : `null`) + `,
        "body": `+ (text.body ? `"` + text.body + `"` : `null`) + `
    },
    "soundEffect": `+ (soundEffect ? `url("media/sound/` + soundEffect + `")` : `null`) + `,
    "isFinalFrame": `+ isFinalFrame + `
}`
}

function generateSLTFrame(type, options, isFinalFrame) {
    let ops = ``
    options.forEach(o => {
        ops += `
        {
            "name": `+ o.name + `,
            "operation": `+ o.operation + `
        },`
    })
    ops = ops.slice(0, ops.length - 1)
    return `{
    "type": "`+ type + `",
    "options": [`+ ops + `
    ],
    "isFinalFrame": `+ isFinalFrame + `
}`
}