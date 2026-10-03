# -*- coding: utf-8 -*-
"""Copies the latest lesson pages from the course workspace (../lessons) into site/lessons, ready to commit."""
import glob, os, shutil, sys
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.normpath(os.path.join(here, '..', '..', 'lessons'))
dst = os.path.normpath(os.path.join(here, '..', 'site', 'lessons'))
files = glob.glob(os.path.join(src, '*.html'))
if not files:
    sys.exit('No lessons found in ' + src)
for f in files:
    shutil.copy2(f, dst)
    print('copied', os.path.basename(f))
