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
 * 使下一帧的影响层叠到当前帧。
*/
function flashFrame() {
    if (frameCode > 0 &&
        getJSONObj(frameScript).frame[frameCode - 1].isFinalFrame)
        flashScene()
    var frame = getJSONObj(frameScript).frame[frameCode]
    var text = document.querySelector("#frame-text")
    var selector = document.querySelector("#frame-selector")
    if (frame.type == "slt") {
        isChoosing = true
        document.querySelector("#graphic-role-l").setAttribute("class", "unspeaking")
        document.querySelector("#graphic-role-r").setAttribute("class", "unspeaking")
        stylify(text, "display: none")
        stylify(selector, "display: block")
        var count = 0
        Array.from(frame.options).forEach(o => {
            selector.innerHTML += `<div class="option" op="` + o.operation + `">` +
                o.name + `</div>`
            count++
        })
        stylify(selector, "--count: " + count)
        Array.from(document.getElementsByClassName("option")).forEach(c => {
            c.onclick = function () {
                c.setAttribute("class", "option selected")
                Array.from(document.getElementsByClassName("option")).forEach(c => {
                    if (c.getAttribute("class") != "option selected")
                        stylify(c, "visibility: hidden")
                })
                new Function(c.getAttribute("op"))()
                setTimeout(function () {
                    isChoosing = false
                    flashFrame()
                }, 3000)
            }
        })
    } else {
        isChoosing = false
        stylify(text, "display: block")
        stylify(selector, "display: none")
        selector.innerHTML = ""
        var bg = document.querySelector("#graphic-bg")
        var bgm = document.querySelector("#music-bg")
        {
            if (frame.bg.pic != null)
                stylify(bg, "background-image: url(" + frame.bg.pic + ")")
            if (frame.bg.music != null) {
                bgm.setAttribute("src", frame.bg.music)
                bgm.play()
            }
            if (frame.bg.effect != null)
                stylify(bg, frame.bg.effect)
        }
        var roleL = document.querySelector("#graphic-role-l")
        var vocalL = document.querySelector("#music-vocal-l")
        {
            if (frame.roleL.pic != null)
                stylify(roleL, "background-image: url(" + frame.roleL.pic + ")")
            if (frame.roleL.vocal != null) {
                roleL.setAttribute("class", "speaking")
                vocalL.setAttribute("src", frame.roleL.vocal)
                vocalL.play()
            }
            else
                roleL.setAttribute("class", "unspeaking")
            if (frame.roleL.effect != null)
                stylify(roleL, frame.roleL.effect)
        }
        var roleR = document.querySelector("#graphic-role-r")
        var vocalR = document.querySelector("#music-vocal-r")
        {
            if (frame.roleR.pic != null)
                stylify(roleR, "background-image: url(" + frame.roleR.pic + ")")
            if (frame.roleR.vocal != null) {
                roleR.setAttribute("class", "speaking")
                vocalR.setAttribute("src", frame.roleR.vocal)
                vocalR.play()
            }
            else
                roleR.setAttribute("class", "unspeaking")
            if (frame.roleR.effect != null)
                stylify(roleR, frame.roleR.effect)
        }
        var speaker = document.querySelector("#text-speaker")
        var body = document.querySelector("#text-body")
        var logs = document.querySelector("#text-logs")
        {
            if (frame.text.speaker != null)
                stylify(speaker, "display: block")
            else
                stylify(speaker, "display: none")
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
 * 清除当前剧本的影响，并载入下一剧本。
*/
function flashScene() {
    frameScript = nextFrameScript
    frameCode = 0
    document.querySelector("#text-logs").innerHTML = ""
}