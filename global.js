/**
 * 模仿jQuery风格：获取元素。这些元素是完全原生的，您可以对其进行任何原生操作。
 * @param {string} eCode 元素码
 * @returns {HTMLElement|HTMLCollectionOf<Element>} HTML元素或集合
 */
function e(eCode) {
    switch (eCode[0]) {
        case "#":
            return document.getElementById(eCode.slice(1));
        case ".":
            return document.getElementsByClassName(eCode.slice(1));
        default:
            return document.getElementsByTagName(eCode);
    }
}

function flashFrame() {
    if (frameCode > 0 &&
        getJSONObj(frameScript).frame[frameCode - 1].isFinalFrame)
        flashScene();
    var frame = getJSONObj(frameScript).frame[frameCode];
    var text = e("#frame-text");
    var choicer = e("#frame-choicer");
    if (frame.type == "choicer") {
        isChoosing = true;
        e("#graphic-role-l").setAttribute("class", "unspeaking");
        e("#graphic-role-r").setAttribute("class", "unspeaking");
        stylify(text, "display: none;");
        stylify(choicer, "display: block;");
        var count = 0;
        Array.from(frame.choices).forEach(c => {
            choicer.innerHTML += `<div class="choice" op="` + c.operation + `">` +
                c.name + `</div>`;
            count++;
        });
        stylify(choicer, "--count: " + count + ";");
        Array.from(e(".choice")).forEach(c => {
            c.onclick = function () {
                c.setAttribute("class", "choice chosen");
                Array.from(e(".choice")).forEach(c => {
                    if (c.getAttribute("class") != "choice chosen")
                        stylify(c, "visibility: hidden;");
                });
                new Function(c.getAttribute("op"))();
                setTimeout(function () {
                    isChoosing = false;
                    flashFrame();
                }, 3000);
            }
        });
    } else {
        isChoosing = false;
        stylify(text, "display: block;");
        stylify(choicer, "display: none;");
        choicer.innerHTML = "";
        var bg = e("#graphic-bg");
        var bgm = e("#music-bg");
        {
            if (frame.bg.pic != null)
                stylify(bg, "background-image: url(" + frame.bg.pic + ");");
            if (frame.bg.music != null) {
                bgm.setAttribute("src", frame.bg.music);
                bgm.play();
            }
            if (frame.bg.effect != null)
                stylify(bg, frame.bg.effect)
        }
        var roleL = e("#graphic-role-l");
        var vocalL = e("#music-vocal-l");
        {
            if (frame.roleL.pic != null)
                stylify(roleL, "background-image: url(" + frame.roleL.pic + ");")
            if (frame.roleL.vocal != null) {
                roleL.setAttribute("class", "speaking");
                vocalL.setAttribute("src", frame.roleL.vocal);
                vocalL.play();
            }
            else
                roleL.setAttribute("class", "unspeaking");
            if (frame.roleL.effect != null)
                stylify(roleL, frame.roleL.effect)
        }
        var roleR = e("#graphic-role-r");
        var vocalR = e("#music-vocal-r");
        {
            if (frame.roleR.pic != null)
                stylify(roleR, "background-image: url(" + frame.roleR.pic + ");")
            if (frame.roleR.vocal != null) {
                roleR.setAttribute("class", "speaking");
                vocalR.setAttribute("src", frame.roleR.vocal);
                vocalR.play();
            }
            else
                roleR.setAttribute("class", "unspeaking");
            if (frame.roleR.effect != null)
                stylify(roleR, frame.roleR.effect)
        }
        var speaker = e("#text-speaker");
        var body = e("#text-body");
        var logs = e("#text-logs")
        {
            if (frame.text.speaker != null)
                stylify(speaker, "display: block;");
            else
                stylify(speaker, "display: none;");
            speaker.innerText = frame.text.speaker;
            isRolling = true;
            roll(body, frame.text.body);
            logs.innerHTML +=
                (frame.text.speaker == null ? "" : frame.text.speaker + "：") +
                    frame.text.body + "<br>";
        }
        if (frame.soundEffect != null) {
            e("#music-effect").setAttribute("src", frame.soundEffect);
            e("#music-effect").play();
        }
    }
    frameCode++;
}

function flashScene() {
    frameScript = nextFrameScript;
    frameCode = 0;
    e("#text-logs").innerHTML = "";
}

function getJSONObj(url) {
    return $.parseJSON($.ajax({
        url: url,
        dataType: "json",
        async: false
    }).responseText);
}

function preFlashFrame() {
    if (isRolling) {
        if (new Date().getTime() - fts < 600)
            return;
        clearInterval(rtid);
        roll(e("#text-body"), stNow, 0);
    } else {
        if (new Date().getTime() - fts < 1000)
            return;
        flashFrame();
    }
}

function reFit() {
    const W_UNIT = window.innerWidth / 16.0;
    const H_UNIT = window.innerHeight / 9.0;
    e("#frame").style.cssText = "zoom: " + ((W_UNIT > H_UNIT ?
        H_UNIT / 720.0 * 9 :
        W_UNIT / 1280.0 * 16) - 0.001) + ";";
}

function roll(container, contain, ts) {
    fts = new Date().getTime();
    container.innerText = "";
    stNow = contain;
    var i = 0;
    rtid = setInterval(function () {
        if (i < contain.length)
            container.innerText += contain[i++];
        else {
            clearInterval(rtid);
            isRolling = false;
            fts = new Date().getTime();
        }
    }, ts == undefined ? 60 : ts);
}

function stylify(e, cssText) {
    if (e.style.cssText == undefined)
        e.style.cssText = "";
    e.style.cssText += cssText;
    return e;
}