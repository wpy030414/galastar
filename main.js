import * as Util from "./utility.js"

/** 剧本 */
var frameScript = "./assets/chapter-test-1.json"
/** 下一剧本 */
var nextFrameScript = frameScript
/** 剧本对象 */
var fss = await Util.getObjFromJSON(frameScript)
/** 剧本帧 */
var frameCode = 0
/** #frame-text隐藏状态 */
var isTextHidden = false
/** #text-logs隐藏状态 */
var isLogsHidden = true
/** 分支选择状态 */
var isChoosing = false
/** 字幕滚动状态 */
var isRolling = false
/** 字幕滚动公共线程ID */
var rtid
/** 正在滚动的字幕 */
var stNow
/** 单帧计时器 */
var fts

/**
 * 使下一帧的影响层叠到当前帧。
*/
async function flashFrame() {
    if (frameCode > 0 && fss.frame[frameCode - 1].isFinalFrame)
        await flashScene()
    var frame = fss.frame[frameCode]
    var text = document.querySelector("#frame-text")
    var selector = document.querySelector("#frame-selector")
    if (frame.type == "slt") {
        isChoosing = true
        document.querySelector("#graphic-role-l").setAttribute("class", "unspeaking")
        document.querySelector("#graphic-role-r").setAttribute("class", "unspeaking")
        Util.stylify(text, "display: none")
        Util.stylify(selector, "display: block")
        var count = 0
        Array.from(frame.options).forEach(o => {
            selector.innerHTML += `<div class="option" op="` + o.operation + `">` +
                o.name + `</div>`
            count++
        })
        Util.stylify(selector, "--count: " + count)
        Array.from(document.getElementsByClassName("option")).forEach(c => {
            c.onclick = function () {
                c.setAttribute("class", "option selected")
                Array.from(document.getElementsByClassName("option")).forEach(c => {
                    if (c.getAttribute("class") != "option selected")
                        Util.stylify(c, "visibility: hidden")
                })
                eval(c.getAttribute("op"))
                setTimeout(function () {
                    isChoosing = false
                    flashFrame()
                }, 3000)
            }
        })
    } else {
        isChoosing = false
        Util.stylify(text, "display: block")
        Util.stylify(selector, "display: none")
        selector.innerHTML = ""
        var bg = document.querySelector("#graphic-bg")
        var bgm = document.querySelector("#music-bg")
        {
            if (frame.bg.pic != null)
                Util.stylify(bg, "background-image: url(" + frame.bg.pic + ")")
            if (frame.bg.music != null) {
                bgm.setAttribute("src", frame.bg.music)
                bgm.play()
            }
            if (frame.bg.effect != null)
                Util.stylify(bg, frame.bg.effect)
        }
        var roleL = document.querySelector("#graphic-role-l")
        var vocalL = document.querySelector("#music-vocal-l")
        {
            if (frame.roleL.pic != null)
                Util.stylify(roleL, "background-image: url(" + frame.roleL.pic + ")")
            if (frame.roleL.vocal != null) {
                roleL.setAttribute("class", "speaking")
                vocalL.setAttribute("src", frame.roleL.vocal)
                vocalL.play()
            }
            else
                roleL.setAttribute("class", "unspeaking")
            if (frame.roleL.effect != null)
                Util.stylify(roleL, frame.roleL.effect)
        }
        var roleR = document.querySelector("#graphic-role-r")
        var vocalR = document.querySelector("#music-vocal-r")
        {
            if (frame.roleR.pic != null)
                Util.stylify(roleR, "background-image: url(" + frame.roleR.pic + ")")
            if (frame.roleR.vocal != null) {
                roleR.setAttribute("class", "speaking")
                vocalR.setAttribute("src", frame.roleR.vocal)
                vocalR.play()
            }
            else
                roleR.setAttribute("class", "unspeaking")
            if (frame.roleR.effect != null)
                Util.stylify(roleR, frame.roleR.effect)
        }
        var speaker = document.querySelector("#text-speaker")
        var body = document.querySelector("#text-body")
        var logs = document.querySelector("#text-logs")
        {
            if (frame.text.speaker != null)
                Util.stylify(speaker, "display: block")
            else
                Util.stylify(speaker, "display: none")
            speaker.innerText = frame.text.speaker
            isRolling = true
            roll(body, frame.text.body)
            logs.innerHTML +=
                (frame.text.speaker == null ? "" : frame.text.speaker + "：") +
                frame.text.body + "<br>"
        }
        if (frame.soundEffect != null) {
            document.querySelector("#music-effect").setAttribute("src", frame.soundEffect)
            document.querySelector("#music-effect").play()
        }
    }
    frameCode++
}

/**
 * 使指定容器内文本按字等时长逐一显现。
 * @param {Element} container 容器
 * @param {String} contain 文本
 * @param {Number} ts 时间间隔
*/
function roll(container, contain, ts) {
    fts = new Date().getTime()
    container.innerText = ""
    stNow = contain
    var i = 0
    rtid = setInterval(function () {
        if (i < contain.length)
            container.innerText += contain[i++]
        else {
            clearInterval(rtid)
            isRolling = false
            fts = new Date().getTime()
        }
    }, ts == undefined ? 60 : ts)
}

/**
 * 检查前往下一帧的请求是否合法。
*/
function preFlashFrame() {
    if (isRolling) {
        if (new Date().getTime() - fts < 600)
            return
        clearInterval(rtid)
        roll(document.querySelector("#text-body"), stNow, 0)
    } else {
        if (new Date().getTime() - fts < 1000)
            return
        flashFrame()
    }
}

/**
 * 清除当前剧本的影响，并载入下一剧本。
*/
async function flashScene() {
    frameScript = nextFrameScript
    frameCode = 0
    fss = await Util.getObjFromJSON(frameScript)
    document.querySelector("#text-logs").innerHTML = ""
}

window.onload = window.onresize = function () {
    Util.reFit()
}

document.onkeydown = function (event) {
    event.target.blur()
    if (!isLogsHidden || isChoosing)
        return
    if (!isTextHidden)
        if (event.code == "Enter")
            preFlashFrame()
    if (event.code == "Space") {
        var text = document.querySelector("#frame-text")
        if (isTextHidden)
            Util.stylify(text, "display: block")
        else
            Util.stylify(text, "display: none")
        isTextHidden = isTextHidden ? false : true
    }
}

document.querySelector("#text-go").onclick = function () {
    preFlashFrame()
}

document.querySelector("#functions-load").onclick = async function () {
    if (localStorage.getItem("frame-script") == null ||
        localStorage.getItem("frame-code") == null)
        return
    frameScript = localStorage.getItem("frame-script")
    frameCode = 0
    fss = await Util.getObjFromJSON(frameScript)
    document.querySelector("#text-logs").innerText = ""
    while (frameCode <= localStorage.getItem("frame-code")) {
        clearInterval(rtid)
        await flashFrame()
    }
}

document.querySelector("#functions-save").onclick = function () {
    localStorage.setItem("frame-script", frameScript)
    localStorage.setItem("frame-code", frameCode - 1)
}

document.querySelector("#functions-logs").onclick = function () {
    var logs = document.querySelector("#text-logs")
    if (isLogsHidden)
        Util.stylify(logs, "display: block")
    else
        Util.stylify(logs, "display: none")
    isLogsHidden = isLogsHidden ? false : true
}

document.querySelector("#functions-settings").onclick = function () {

}
