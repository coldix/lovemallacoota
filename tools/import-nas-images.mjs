import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const nasRoot = '/Volumes/Media/Docs/OZonLine/A-Businesses';
const repoRoot = '/Users/dixon/web/lovemallacoota';

const imageMap = [
  // EAT & DRINK
  { target: 'images/bus/eat/mh10-cafe-541.webp', source: 'Cafe54/cafe54-01.jpg' },
  { target: 'images/bus/eat/mh14-gipsy-point-lodge-cafe-restaurant1.webp', source: 'Gipsy Pt Lodge/gipsy-dining-2.jpg' },
  { target: 'images/bus/eat/mh03-kelpys-seafood1.webp', source: 'Kelpys/Kelpys2.jpg' },
  { target: 'images/bus/eat/mh12-lees-pizza-take-away1.webp', source: 'Lees Take Away/Lees 1.jpg' },
  { target: 'images/bus/eat/mh11-lucys-chinese-restaurant1.webp', source: 'Lucy/LucysNoodles.jpg' },
  { target: 'images/bus/eat/mh13-mallacoota-bakery1.webp', source: 'Bakery/Bakery 500.jpg' },
  { target: 'images/bus/eat/mh08-mallacoota-golf-club-bistro1.webp', source: 'Golf Club/Golf Club 27 Feb Banner 1920.jpg' },
  { target: 'images/bus/eat/mh05-origami-coffee1.webp', source: 'Origami/OrigamiCoffeeLogo.jpg' },
  { target: 'images/bus/eat/mh01-mallacoota-hotel-motel-bistro1.webp', source: 'Hotel - Pub/Mallacoota-Main-St-29-Nov-2021.jpg' },

  // ACCOMMODATION
  { target: 'images/bus/acc/acc04-adobe-mudbrick-holiday-flats1.webp', source: 'Adobe Flats/adobe-mudbrick-holiday.jpg' },
  { target: 'images/bus/acc/acc18-adobe-abodes1.webp', source: 'Adobe Flats/abodes.jpg' },
  { target: 'images/bus/acc/acc12-awangralea-caravan-park1.webp', source: '78 Betka Road/cabins01.jpg' },
  { target: 'images/bus/acc/acc14-beachcomber-caravan-park1.webp', source: 'Beachcombers/Beachcombers.JPG' },
  { target: 'images/bus/acc/acc10-lakeside-at-mallacoota1.webp', source: 'Beachcombers/lakeside-at-mallacoota 01.jpg' },
  { target: 'images/bus/acc/acc06-bruces-waterside-units1.webp', source: 'Bruces Flats/bruces-waterside-horizontal-version2-narrow.png' },
  { target: 'images/bus/acc/acc07-gipsy-point-lodge1.webp', source: 'Gipsy Pt Lodge/gipsy-exteriors002.jpg' },
  { target: 'images/bus/acc/acc13-mallacoota-foreshore-holiday-park1.webp', source: 'ForeshorePark/ForeshorePark.jpg' },
  { target: 'images/bus/acc/acc03-shady-gully-caravan-park1.webp', source: 'ShadyGullyPark/Shady Gully Sign V2 Wide photo.jpg' },
  { target: 'images/bus/acc/mh01-mallacoota-hotel-motel-bistro1.webp', source: 'Hotel - Pub/Mallacoota-Main-St-29-Nov-2021.jpg' },
  { target: 'images/bus/acc/acc01-karbeethong-lodge1.webp', sourceAbs: path.join(repoRoot, 'images/bank/karbeethong-lodge.webp') },

  // SHOP
  { target: 'images/bus/shop/shop01-bribes-gift-shop-and-fresh-flowers1.webp', source: 'Bribes/Bribes.jpg' },
  { target: 'images/bus/shop/shop02-wilderness-coast-candles1.webp', source: 'Wilderness Coast Candles/WilderNessCircle.jpg' },

  // ACTIVITIES & TOURS
  { target: 'images/bus/act/tour01-buckland-jetty-boat-hire1.webp', source: 'boats/buckland01.jpg' },
  { target: 'images/bus/act/tour03-mallacoota-hire-boats1.webp', source: 'boats/HIre Boats 01.jpg' },
  { target: 'images/bus/act/tour02-mv-loch-ard-dale-winward1.webp', source: 'boats/Loch-ard.jpg' },
  { target: 'images/bus/act/do008-bunker-museum.webp', source: 'Bunker/bunker.jpg' },
];

async function convertAndSave() {
  let convertedCount = 0;
  for (const item of imageMap) {
    const srcPath = item.sourceAbs ? item.sourceAbs : path.join(nasRoot, item.source);
    const destPath = path.join(repoRoot, item.target);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(srcPath)) {
      console.warn(`[MISSING SOURCE] ${srcPath}`);
      continue;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    try {
      await sharp(srcPath)
        .resize({ width: 1280, height: 960, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(destPath);
      console.log(`✓ Converted: ${item.source || item.sourceAbs} -> ${item.target}`);
      convertedCount++;
    } catch (err) {
      console.error(`✗ Error processing ${item.source}:`, err.message);
    }
  }
  console.log(`\nSuccessfully converted and saved ${convertedCount} images.`);
}

convertAndSave();
