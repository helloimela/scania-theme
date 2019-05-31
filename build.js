const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const Fontmin = require('fontmin');
// const webpack = require('webpack');
const svg2img = require('svg2img');
const css = require('css');
const favicons = require('favicons');
const sass = require('node-sass');
const base64Img = require('base64-img');

const { CssSelectorParser } = require('css-selector-parser');

const outputFolder = 'dist';
const themeName = 'scania';

const selectorParser = new CssSelectorParser();

selectorParser.registerSelectorPseudos('hover', 'active', 'focus', 'before', 'after');
selectorParser.registerNestingOperators('>', '+', '~');
selectorParser.registerAttrEqualityMods('^', '$', '*', '~');
selectorParser.enableSubstitutes();

console.log('-- Start 9 steps --');

// TODO: When we use a task handler we dont need this cb setup
initFolders(() => initFonts(() => initImages(() => initFavicons(initTheme))));


async function initFolders(cb) {

  console.log('1. Folders');

  await fs.remove(outputFolder);

  ['fonts', 'images', 'styles'].map(folder => {
    fs.mkdirSync(`${outputFolder}/${folder}`, { recursive: true });
  })

  cb();
}

function initFonts(cb) {

  console.log('2. Fonts');

  const fonts = 'src/fonts/**/*.ttf';
  const fontmin = new Fontmin()
    .src(fonts)
    .use(Fontmin.glyph({
      hinting: false         // keep ttf hint info (fpgm, prep, cvt). default = true
    }))
    .use(Fontmin.ttf2woff2())
    // .use(Fontmin.css())
    .dest(outputFolder + '/fonts');

  fontmin.run((error, files) => {
    if (error) throw error;

    console.log('3. Font face');

    glob.sync(fonts).forEach(generateFontCss);

    // console.log('4. Font module');

    // const compiler = webpack({
    //   entry: './src/fonts.js',
    //   mode: 'development',
    //   output: {
    //     path: path.resolve(__dirname, outputFolder + '/fonts'),
    //     filename: 'fonts.js'
    //   },
    //   module: {
    //     rules: [
    //       { test: /\.css$/, loader: 'style-loader!css-loader' },
    //       { test: /\.(woff2|ttf)$/, loader: 'url-loader?limit=100000' }
    //     ]
    //   }
    // });

    // compiler.run(function(error, stats) {
    //   if (error) throw error;

    //   cb();
    // });

    cb();
  });
}

function initImages(cb) {

  console.log('4. Images');

  glob.sync('src/images/*.svg').forEach(generateImages);

  cb();
}

async function initFavicons(cb) {

  console.log('5. Favicons');

  const options = {
    path: '',
    icons: {
      android: false,
      appleIcon: false,
      appleStartup: false,
      coast: false,
      favicons: true,
      firefox: false,
      windows: false,
      yandex: false,
    }
  };

  await favicons('src/images/symbol.svg', options, generateFavicons);

  cb();
}

async function initTheme() {
  let style = {};
  let theme = {};

  console.log('7. Styles');

  glob.sync('src/styles/[!_]*.scss').forEach(generateCss);

  console.log('8. Style module');

  await glob.sync(`${outputFolder}/styles/*.css`).forEach(file => {
    const name = path.parse(file).name;
    const data = fs.readFileSync(path.resolve(file), 'utf8');

    style[name] = refToData(data);
    // TODO: branch variable should be fetched from travis and contain either branch path
    // For example: "branch/improvement/footer_mobile_mode/www" or "4.0.0-alpha.1/www"
    var branch = '';

    var root = branch ? `https://static.scania.com/build/global/'${branch}` : '';
    theme[name] = data.replace(/url\(../g, 'url(' + root);
  });

  fs.writeFileSync(`${outputFolder}/module.js`, `export const theme = ${ JSON.stringify(style, null, 2) };`, { flag: 'a' });

  console.log('9. Theme module');

  fs.writeFileSync(`${outputFolder}/${themeName}-theme.js`, `
const components = ${ JSON.stringify(theme, null, 2) };

document.addEventListener('storeReady', event => {
  const store = event.detail.store;
  const actions = event.detail.actions;
  const theme = { ${themeName}: components };
  store.dispatch({ type: actions.ADD_THEME, theme });
});
  `,
  { flag: 'w' });

  console.log('-- Done 9 steps --');

  // renderModule('src/images/favicon.ico');
}

function generateFontCss(file) {
  const props = path.parse(file);
  const type = props.dir.split('/').pop();
  const name = props.name
    .replace(/CY|-|Regular/g, '')
    .split(/(?=[A-Z])/).join(' ');
  const unicode = type === 'cyrillic' ? `
  unicode-range: U+0400-04FF;` : '';

  let content;

  if(props.name.indexOf('Bold') > -1) {
    content = `
  font-family: "${name.replace(' Bold', '')}";
  font-weight: bold;${
    unicode
  }`;
  } else if(props.name.indexOf('Italic') > -1) {
    content = `
  font-family: "${name.replace(' Italic', '')}";
  font-style: italic;${
    unicode
  }`;
  } else {
    content = `
  font-family: "${name}";${
    unicode
  }`;
  }

  const data = generateFontFace(file, content);

  fs.writeFileSync(`${outputFolder}/fonts/fonts.css`, data, { flag: 'a' });
}

async function generateImages(file) {
  const props = path.parse(file);
  const content = fs.readFileSync(file);

  fs.copyFileSync(file, `${outputFolder}/images/${props.base}`);

  await svg2img(content, (error, buffer) => {
    if (error) throw error;

    fs.writeFileSync(`${outputFolder}/images/${props.name}.png`, buffer);
  });
}

async function generateFavicons(error, response) {
  if (error) throw error;

  [ ...response.images, ...response.files ].map(image => {
    fs.writeFileSync(`${outputFolder}/${image.name}`, image.contents);
  });

  const content = response.html.map(data => {
    return data.replace(/(href|content)="(.*?)"/g, (hit, group1, group2) => {
      var elm = hit;
      if(group2.indexOf('.') > -1) {
        data2 = base64Img.base64Sync(`${outputFolder}/${group2}`);
        elm = elm.replace(group2, data2);
      }
      return elm;
    });
  });

  console.log('6. Favicon module');

  await fs.writeFileSync(`${outputFolder}/module.js`, `export const favicons = ${ JSON.stringify(content) };\n`);
}

function generateFontFace64(file, props) {
  const content = fs.readFileSync(file, 'base64');
  return `@font-face {${
    props
  }
  src: url(data:application/font-woff2;charset=utf-8;base64,${content}) format("woff2"), /* Modern Browsers */
       url(data:font/ttf;charset=utf-8;base64,${content}) format("truetype"); /* Safari, Android, iOS 4.2+ */\n}\n`;
}

function generateFontFace(file, props) {
  const filename = file.replace(/src\/fonts\/|.ttf/g, '');
  return `@font-face {${
    props
  }
  src: url("${filename}.woff2") format("woff2"), /* Modern Browsers */
       url("${filename}.ttf") format("truetype"); /* Safari, Android, iOS 4.2+ */\n}\n`;
}

function generateCss(file) {
  const name = path.parse(file).name;
  const data = fs.readFileSync(path.resolve(file), 'utf8');
  const filepath = `${outputFolder}/styles/${name}`;
  const content = sass.renderSync({ data, includePaths: [ 'src/styles' ] }).css;
  // c-theme is shadow true so we dont need to polyfill its content
  let content_ie =  content
    .toString()
    .replace(/:root {([^}]*)}/, '');

  if(name !== 'c-theme') {
    content_ie = polyfill(name, content_ie);
  }

  fs.writeFileSync(`${filepath}.css`, content);
  fs.writeFileSync(`${filepath}_ie.css`, content_ie);
}

function refToData(data) {
  data = data.replace(/@import url\((.*?)\)/g, (hit, group) => {
    let content = fs.readFileSync(`${outputFolder}/styles/${group}`, 'utf8');
    return content;
  });

  data = data.replace(/url\((.*?)\)/g, (hit, group) => {
    const filepath = group.replace(/"|'/g, '');
    const extension = path.parse(filepath).ext;

    let head = '';
    let content;

    switch (extension) {
      case '.png':
      case '.svg':
      case '.jpg':
        content = base64Img.base64Sync(`${outputFolder}/styles/${filepath}`);
        break;
      case '.ttf':
        head = 'data:font/ttf;charset=utf-8;base64,';
        content = fs.readFileSync(`${outputFolder}/fonts/${filepath}`, 'base64');
        break;
      case '.woff2':
        head = 'data:application/font-woff2;charset=utf-8;base64,';
        content = fs.readFileSync(`${outputFolder}/fonts/${filepath}`, 'base64');
        break;
      default:
        content = filepath;
        break;
    }

    return `url(${head}${content})`;
  });

  return data;
}

function renderModule(file) {
  const data = fs.readFileSync(path.resolve(file), 'utf8');
  const content = sass.renderSync({ data, includePaths: ['src/styles'] }).css.toString();
  let obj = {};

  obj[ path.parse(file).name ] = {
    "default": content,
    "ie": polyfill(path.parse(file).name, content),
  };

  return obj;
}

function polyfill(name, content) {
  const prefix = '.sc-';

  content = content
    .replace(/::slotted\((.*?)\)/g, prefix + name + '-s > $1')
    .replace(/:host\((.*?)\)/g, prefix + name + '-h' + '$1')
    .replace(/:host/g, prefix + name + '-h')
    .replace(/::/g, ':');

  const cssObj = css.parse(content);

  cssObj.stylesheet.rules.map(rule => {
    if(!rule.selectors) return;

    const selectorObj = selectorParser.parse( rule.selectors.join(',') );

    (selectorObj.selectors ? selectorObj.selectors : [ selectorObj ])
      .map(selector => ie(selector, name));

    rule.selectors = selectorParser.render(selectorObj).split(',');
  });

  return css.stringify(cssObj);
}

function ie(item, name) {
  const cls = 'sc-' + name;
  const classes = [ cls ];
  if(item.type === 'rule' && (item.classNames || []).join().indexOf(cls) === -1) {
    item.classNames = item.classNames ? [ ...item.classNames, ...classes ] : classes
  }
  if(item.rule && (item.classNames || []).indexOf(cls + '-s') === -1) {
    item.rule = ie(item.rule, name);
  }
  return item;
}
