/**
 * 依据JSON文件地址构造JSON对象。
 * @param {String} url JSON文件地址
 * @returns {Object} JSON对象
*/
export async function getObjFromJSON(url) {
    const objT = await fetch(url)
    return objT.json()
}

/**
 * 根据窗口尺寸调整画面位置。
*/
export function reFit() {
    const W_UNIT = window.innerWidth / 16.0
    const H_UNIT = window.innerHeight / 9.0
    stylify(document.querySelector("#frame"), "zoom: " + ((W_UNIT > H_UNIT ?
        H_UNIT / 720.0 * 9 :
        W_UNIT / 1280.0 * 16) - 0.001) + "")
}

/**
 * 风格化HTML元素。
 * @param {Element} e HTML元素
 * @param {String} cssText CSS属性字符串。若为空则表示清空所有内联样式
*/
export function stylify(e, cssText) {
    if (e.style.cssText == undefined)
        e.style.cssText = ""
    e.style.cssText += cssText
}