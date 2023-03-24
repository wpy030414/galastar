/** 剧本 */
var frameScript = "data/chapter-test-1.json"
/** 下一剧本 */
var nextFrameScript = "data/chapter-test-1.json"
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

window.onload = window.onresize = function () {
    reFit()
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
            stylify(text, "display: block")
        else
            stylify(text, "display: none")
        isTextHidden = isTextHidden ? false : true
    }
}

document.querySelector("#text-go").onclick = function () {
    preFlashFrame()
}

document.querySelector("#functions-load").onclick = function () {
    if (localStorage.getItem("frame-script") == null ||
        localStorage.getItem("frame-code") == null)
        return
    frameScript = localStorage.getItem("frame-script")
    frameCode = 0
    document.querySelector("#text-logs").innerText = ""
    while (frameCode <= localStorage.getItem("frame-code")) {
        clearInterval(rtid)
        flashFrame()
    }
}

document.querySelector("#functions-save").onclick = function () {
    localStorage.setItem("frame-script", frameScript)
    localStorage.setItem("frame-code", frameCode - 1)
}

document.querySelector("#functions-logs").onclick = function () {
    var logs = document.querySelector("#text-logs")
    if (isLogsHidden)
        stylify(logs, "display: block")
    else
        stylify(logs, "display: none")
    isLogsHidden = isLogsHidden ? false : true
}

document.querySelector("#functions-settings").onclick = function () {

}