/**
 * editorial-typography.js
 * Implements a two-font contrast system by emphasizing key words.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.getAttribute('data-page-type') !== 'project') {
        return;
    }

    const paragraphs = document.querySelectorAll('.post-content p');

    paragraphs.forEach((p) => {
        // Skip paragraphs that contain nested HTML (like <br>) for simplicity
        if (p.children.length > 0) {
            return;
        }

        const text = p.textContent.trim();
        if (!text) {
            return;
        }

        const words = text.split(/\s+/);
        if (words.length < 2) {
            return;
        }

        const lastWordIndex = words.length - 1;
        const lastWord = words[lastWordIndex];

        // Wrap the last word in the serif emphasis span
        words[lastWordIndex] =
            `<span class="serif" style="font-style: italic; opacity: 0.9;">${lastWord}</span>`;

        p.innerHTML = words.join(' ');
    });
});
