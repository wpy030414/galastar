var frameCode = 0;
var isTextHidden = false;

window.onload = window.onresize = function () {
    const W_UNIT = window.innerWidth / 16.0;
    const H_UNIT = window.innerHeight / 9.0;
    document.getElementById("frame").style.cssText =
        "zoom: " + (W_UNIT > H_UNIT ? H_UNIT / 720.0 * 9 : W_UNIT / 1280.0 * 16) + ";";
}

document.documentElement.onkeydown = function (event) {
    if (!isTextHidden)
        if (event.code == "Space")
            flashFrame("data/chapter-test.json");
    if (event.code == "Enter") {
        var text = document.getElementById("frame-text");
        if (isTextHidden)
            stylify(text, "display: block");
        else
            stylify(text, "display: none");
        isTextHidden = isTextHidden ? false : true;
    }
}

document.getElementById("frame-text").onclick = function () {
    flashFrame("data/chapter-test.json");
}

document.getElementById("functions-load").onclick = function () {

}

document.getElementById("functions-save").onclick = function () {

}

document.getElementById("functions-logs").onclick = function () {

}

document.getElementById("functions-settings").onclick = function () {

}