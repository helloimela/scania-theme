# Scania Theme

Scania theme is a package to style Scania looks and feel in the [Corporate UI 4.0 alpha setup](https://github.com/scania/corporate-ui-dev/).

## Installation

### CDN link

Add link to the script by adding the following to the `<head></head>`. Make sure to include scania-theme script BEFORE the corporate-ui script.
```
<script src="https://static.scania.com/build/global/themes/scania/1.x/scania-theme.js"></script>
<script src="https://static.scania.com/build/global/4.x/corporate-ui.js"></script>
```
Replace `x` with [available releases](https://www.npmjs.com/package/scania-theme).

### NPM package

Install scania-theme package by running the command below.
```
npm i scania-theme
```
Import `theme` in the project and use it with `addTheme` function from corporate-ui.

```
import { defineCustomElements, addTheme } from 'corporate-ui-dev/dist/'; 
import { theme as scania } from 'scania-theme'; 
 
defineCustomElements('all'); 
addTheme(scania);
```

## Setup in project

Initialize the theme with the `c-theme` component. Set `global` attribute to true in order to enable bootstrap styling.

```
<c-theme name="scania" global="true"></c-theme>
```
