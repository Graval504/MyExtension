// ==UserScript==
// @name         ArcaGallery
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Show Image With Titles.
// @author       Graval504
// @match        https://arca.live/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=arca.live
// @downloadURL  https://github.com/Graval504/MyExtension/raw/refs/heads/main/ArcaGallery.user.js
// @updateURL    https://github.com/Graval504/MyExtension/raw/refs/heads/main/ArcaGallery.user.js
// @grant        none
// @license      DBAD
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
    function showTitleImage() {
        var articleList = document.querySelectorAll('.article-list > .list-table.table > [class="vrow column"]')
        articleList.forEach((article, index) => {
            var hasImage = article.querySelector(".vrow-preview")
            if (hasImage) {
                var img = article.querySelector(".vrow-preview > img")
                if (!img) return
                article.style.height = "112px"
                article.querySelector(".col-title").prepend(img)
                hasImage.remove()
            }

        })
    }

    //script start
    console.log("[ArcaGallery]: loading FIST..")
    setInterval(showTitleImage,1000)
    console.log("[ArcaGallery]: Active.")
})();