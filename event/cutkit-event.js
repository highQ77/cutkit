// target is event "this", ex: <span onclick="show(this)">test</span>

function hide(target, popupClassName) {
    [...document.getElementsByClassName(popupClassName)].forEach(i => {
        i.style.visibility = 'hidden'
    })
}

function show(target, popupClassName) {
    [...document.getElementsByClassName(popupClassName)].forEach(i => {
        i.style.visibility = 'visible'
    })
}

function gotoPage(target, url) {
    location.href = url
}

// hide all popups
[...document.body.getElementsByTagName('*')].filter(i => i.className.indexOf('~') > -1).forEach(i => i.style.visibility = 'hidden')