function getJSONObj(url) {
    return $.parseJSON($.ajax({
        url: url,
        dataType: "json",
        async: false
    }).responseText);
}

function stylify(e, cssText) {
    if (e.style.cssText == undefined)
        e.style.cssText = "";
    e.style.cssText += cssText;
    return e;
}

function flashFrame(dataUrl) {
    if (frameCode == undefined)
        return;
    var frame = getJSONObj(dataUrl).frame[frameCode++];
    var bg = document.getElementById("frame-bg");
    var speaker = document.getElementById("text-speaker");
    var body = document.getElementById("text-body");
    var roleL = document.getElementById("frame-role-l");
    var roleR = document.getElementById("frame-role-r");
    {
        if (frame.bg.picUrl != null)
            stylify(bg, "background-image: url(" + frame.bg.picUrl + ");");
        if (frame.bg.effect != null)
            stylify(bg, frame.bg.effect)
    }
    {
        if (frame.text.speaker == "")
            stylify(speaker, "display: none;");
        else
            stylify(speaker, "display: block;");
        speaker.innerText = frame.text.speaker;
        body.innerText = frame.text.body;
    }
    {
        if (frame.roleL.picUrl != null)
            stylify(roleL, "background-image: url(" + frame.roleL.picUrl + ");")
        if (frame.roleL.isSpeaking)
            roleL.setAttribute("class", "speaking");
        else
            roleL.setAttribute("class", "unspeaking");
        if (frame.roleL.effect != null)
            stylify(roleL, frame.roleL.effect)
    }
    {
        if (frame.roleR.picUrl != null)
            stylify(roleR, "background-image: url(" + frame.roleR.picUrl + ");")
        if (frame.roleR.isSpeaking)
            roleR.setAttribute("class", "speaking");
        else
            roleR.setAttribute("class", "unspeaking");
        if (frame.roleR.effect != null)
            stylify(roleR, frame.roleR.effect)
    }
    if (frame.isFinalFrame)
        frameCode = undefined;
}