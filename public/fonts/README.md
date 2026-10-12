# Website fonts

The reference pairs **Cezanne Regular** with **Cantoria Semibold**. Their
providers require a webfont license / account; neither was supplied.
The site ships this open-source interpretation, not the exact faces:

- **Mr De Haviland Regular**: handwritten display headings.
- **Lora Regular (400), with medium (500) labels**: body text, labels, controls, and compact titles.
- **Manrope Variable**: clean sans-serif body text and form controls.

Files come from the official Google Fonts repository and are self-hosted.
The accompanying SIL Open Font License files must stay with the fonts.
Manrope's license is in `manrope-OFL.txt`.

- https://github.com/google/fonts/tree/main/ofl/mrdehaviland
- https://github.com/google/fonts/tree/main/ofl/lora

All pages use `public/typography.css`. To switch to the exact reference fonts
later, add their webfont files, update its `@font-face` declarations and
family variables, and update the font preload URLs in `index.html`.

Exact reference sources:
- https://p22.com/fonts/cezanne/
- https://fonts.adobe.com/fonts/p22-cezanne
- https://www.myfonts.com/products/pro-semibold-cantoria-mt-345186/
