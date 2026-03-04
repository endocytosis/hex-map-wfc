
# Blog Post Structure: 
- funny pithy intro.
  - i always lover geberative dungeons since the AD&D DMs guide
  - wfc allows complex genarive patterns that all match up. Like a jigsaw puzzle, or carcossone. WFC collapse is basically doing the puzzle - you might get stuck.

- modular wfc. wfc is reliebale for small grids, but as the grid gets bigger the chnace of getting into a dead-end are higher. The solution - modular WFC creates mutple small hex grids then attempts to stiche them together at the edges.
  - wfc with hexes: same as grid but more edge choices
  - 3d wfc with levels l(image of road deadendending in sky)
  - wfc recovery. many diff attempts. local-wfc being the solution. list things we tried (check old notes)
  - tiles - kaykits great pack. this already has tiles that are set up for seamless connecting. Turns out it was missing some useful tiles to get closer to 
    adding my owwn connectors (river + road slopes, river dead-end, river to coast) to get closer to sub-complete tilesets. bust out blender modeling chops.

- hex coords (digression). hex math is weird. since there are 6 directoins not 4, there is no simple mapping between hex coords and 2d x,y coords. The naive approarh is to use offset coords, numbering L-R and T-D but this becoemes onfusing. Lots of math going back and forth. Turns out there is a much better system: Axial or cube cords. 3d coord system for the 3 axese. allow you to find neightbor positions etc mush easier. Fortunaely WFC doesnt really card about geometry, it is concerned about which edges match to each other similar to a graph or tree structure. hex of hexes have offsets.

- water rendering .
  - waves + coveyness -  bad north style waves. using expand and blur to generate sdf gradient.
    - waves too strched in coves, had to do cpu souroundedness probe to mask cells. TODO: JFA
  - sparkles - to achieve zelda oceanina of time style pattern. img is chepaer and better than 3x voronio noise

- Post proc. AO, shadows, lighting, effects. shadow map built around cam for beter resolution. other postproc (image switching between debug views) mapping elevation to different biome texture png.

- tree + building noise (better to cluster than use wfc. large scale patterns)

- Optimizations - using batched meshes (tiles) and instanced mesehes (decoration)
- Creting new tiles, Setting UVs in blender

- Summary - This was a fun experiment to get WFC working with hexes. It's super satisfying to see the road and river systems matching up perfectly.  The resulting app is super performant running at 60fps on desktop and mobile.

- about me section and link to airtight.cc

- credits -  to Kay kit builder, codrops article, that wfc guy
- full source code avaiable (link to github)


## check for other things to add from notes/history

## Images 
  - lots of images some full bleed some column width, some small 2x in a row. Clikc image to show full screen?
  - usee CSS slideshows to crossfade between images

## Style
  - casual funny but also smart.
  - descibe strugles /challenges with positive wins at the end.
