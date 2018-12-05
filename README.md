# Codemods for Pix

```
$ npm install -g jscodeshift@0.5.1
$ git clone git@github.com:1024pix/codeshift
$ git clone git@github.com:1024pix/pix
$ cd pix/api
$ jscodeshift -t ../../codeshift/pixtransform.js  tests/ lib/
```
