/* ============================================================================
   Linear models and regularization — widget 14. DRAFT.

   Hosts at PHM5005 `04-3 Tour of Algorithms`, section 1, "Linear & Regularised
   Regression". That section's own table is the widget:

       Simple Linear Regression   a1 = 0, a2 = 0
       Ridge Regression (L2)      a1 = 0, a2 > 0
       Lasso Regression (L1)      a1 > 0, a2 = 0
       ElasticNet (mixture)       a1 > 0, a2 > 0

   Four rows that students read as four algorithms. They are four settings of one
   objective, which the notebook also prints two lines above the table:

       min ||y - (Xw + b)||^2  +  a1 ||w||_1  +  a2 ||w||_2^2

   So the controls are the two dials, and the four names are positions in a grid
   drawn beside the coefficients. Nothing else is a choice.

   ---------------------------------------------------------------------------
   WHY THE TARGET COLUMN IS DROPPED. `04-3` fits on
   `data_fat.drop(columns=["BodyFat"])`, which keeps `Density`. BodyFat is
   derived from Density by Siri's equation, 495/D - 450, and on this CSV that
   reproduces the target to within 0.1 percentage points for 243 of 252 men. The
   printed R2 table (0.992 down to 0.767) is therefore not comparing algorithms;
   it is measuring how hard each one shrinks a leaked feature. Density is out
   here, which leaves 13 measurements and an unpenalised R2 of 0.749.

   ---------------------------------------------------------------------------
   TWO PANELS, AND THE SLICE THAT MAKES THEM ONE MODEL.

   The bars are the real fit: thirteen coefficients, both penalties applied at
   once. The plane can only hold two. An earlier build fitted a separate
   two-feature model for the plane, and the two panels then disagreed about
   Abdomen — 8.80 on the plane against 10.27 in the bars — because those are
   different models, not different views.

   The plane is a CONDITIONAL SLICE instead: the other eleven coefficients held
   where they were fitted, the selected pair free. That slice is exact rather
   than approximate, and the reason is the solver. A coordinate-descent fixed
   point IS the statement that the solution is already optimal in any subset of
   coordinates given the rest, so the point sits exactly where the contour meets
   the constraint in the slice too. Re-solving the slice returns the same
   coefficients to machine zero.

   Profiling the other eleven out instead — the more obvious choice — is wrong:
   at a lasso solution the other coordinates' gradients are not zero, they equal
   the subgradient, so a profiled contour is not tangent to anything.

   ---------------------------------------------------------------------------
   WHY THE CONTOURS ARE ALWAYS TILTED AT 45 DEGREES. With standardised features
   the 2x2 block of the Gram matrix is [[1, r], [r, 1]], whose eigenvectors are
   (1,1) and (1,-1) for every r. So the tilt carries nothing and the ELONGATION
   carries everything: it is exactly sqrt((1+r)/(1-r)). The pair selector runs
   from Weight/Hip at 5.69:1 down to Abdomen/Height at 1.09:1, and on that last
   one the diamond and the circle behave almost identically — which is the case
   where the choice between them does not matter, and it belongs on the widget
   for the same reason a heavy-tailed population belongs in the CLT (2.6).

   ---------------------------------------------------------------------------
   NO DRIVE BUTTONS, AND NO SEED. Principle 4.5. There are two dials, so a Play
   would have to pick one to walk and the label could not say which without
   naming a third control. Dragging a dial IS the motion here, and the dashed
   trail already shows the whole route from the unpenalised fit to wherever the
   dials now sit. Nothing is random either: all 252 men are fitted every time, so
   a seed would be a control with no idea in it (3.5).

   The widget opens at a1 = a2 = 0. That is plain linear regression — the
   starting point of the table, not its answer (2.1).

   ---------------------------------------------------------------------------
   ALPHA IS ON SKLEARN'S LASSO CONVENTION, which divides the fit term by 2n:

       (1/2n)||y - Xw||^2 + a1||w||_1 + (a2/2)||w||_2^2

   sklearn's `Ridge` does NOT divide, so the same number is a penalty about 2n
   times weaker there. One convention had to be picked for a shared ladder, and
   the lasso one is picked because the corner is what the widget is about.
   ========================================================================= */

import { defineWidget, makePlot, fmt } from "../core/index.js";

/* Body fat, 252 men, 13 measurements plus the outcome. Density is deliberately
   absent — see the header. Source: github.com/kennethban/dataset/bodyfat.csv */
const COLS = "Age,Weight,Height,Neck,Chest,Abdomen,Hip,Thigh,Knee,Ankle,Biceps,Forearm,Wrist".split(",");
const RAW = "23,154.25,67.75,36.2,93.1,85.2,94.5,59,37.3,21.9,32,27.4,17.1,12.3;22,173.25,72.25,38.5,93.6,83,98.7,58.7,37.3,23.4,30.5,28.9,18.2,6.1;22,154,66.25,34,95.8,87.9,99.2,59.6,38.9,24,28.8,25.2,16.6,25.3;26,184.75,72.25,37.4,101.8,86.4,101.2,60.1,37.3,22.8,32.4,29.4,18.2,10.4;24,184.25,71.25,34.4,97.3,100,101.9,63.2,42.2,24,32.2,27.7,17.7,28.7;24,210.25,74.75,39,104.5,94.4,107.8,66,42,25.6,35.7,30.6,18.8,20.9;26,181,69.75,36.4,105.1,90.7,100.3,58.4,38.3,22.9,31.9,27.8,17.7,19.2;25,176,72.5,37.8,99.6,88.5,97.1,60,39.4,23.2,30.5,29,18.8,12.4;25,191,74,38.1,100.9,82.5,99.9,62.9,38.3,23.8,35.9,31.1,18.2,4.1;23,198.25,73.5,42.1,99.6,88.6,104.1,63.1,41.7,25,35.6,30,19.2,11.7;26,186.25,74.5,38.5,101.5,83.6,98.2,59.7,39.7,25.2,32.8,29.4,18.5,7.1;27,216,76,39.4,103.6,90.9,107.7,66.2,39.2,25.9,37.2,30.2,19,7.8;32,180.5,69.5,38.4,102,91.6,103.9,63.4,38.3,21.5,32.5,28.6,17.7,20.8;30,205.25,71.25,39.4,104.1,101.8,108.6,66,41.5,23.7,36.9,31.6,18.8,21.2;35,187.75,69.5,40.5,101.3,96.4,100.1,69,39,23.1,36.1,30.5,18.2,22.1;35,162.75,66,36.4,99.1,92.8,99.2,63.1,38.7,21.7,31.1,26.4,16.9,20.9;34,195.75,71,38.9,101.9,96.4,105.2,64.8,40.8,23.1,36.2,30.8,17.3,29;32,209.25,71,42.1,107.6,97.5,107,66.9,40,24.4,38.2,31.6,19.3,22.9;28,183.75,67.75,38,106.8,89.6,102.4,64.2,38.7,22.9,37.2,30.5,18.5,16;33,211.75,73.5,40,106.2,100.5,109,65.8,40.6,24,37.1,30.1,18.2,16.5;28,179,68,39.1,103.3,95.9,104.9,63.5,38,22.1,32.5,30.3,18.4,19.1;28,200.5,69.75,41.3,111.4,98.8,104.8,63.4,40.6,24.6,33,32.8,19.9,15.2;31,140.25,68.25,33.9,86,76.4,94.6,57.4,35.3,22.2,27.9,25.9,16.7,15.6;32,148.75,70,35.5,86.7,80,93.4,54.9,36.2,22.1,29.8,26.7,17.1,17.7;28,151.25,67.75,34.5,90.2,76.3,95.8,58.4,35.5,22.9,31.1,28,17.6,14;27,159.25,71.5,35.7,89.6,79.7,96.5,55,36.7,22.5,29.9,28.2,17.7,3.7;34,131.5,67.5,36.2,88.6,74.6,85.3,51.7,34.7,21.4,28.7,27,16.5,7.9;31,148,67.5,38.8,97.4,88.7,94.7,57.5,36,21,29.2,26.6,17,22.9;27,133.25,64.75,36.4,93.5,73.9,88.5,50.1,34.5,21.3,30.5,27.9,17.2,3.7;29,160.75,69,36.7,97.4,83.5,98.7,58.9,35.3,22.6,30.1,26.7,17.6,8.8;32,182,73.75,38.7,100.5,88.7,99.8,57.5,38.7,33.9,32.5,27.7,18.4,11.9;29,160.25,71.25,37.3,93.5,84.5,100.6,58.5,38.8,21.5,30.1,26.4,17.9,5.7;27,168,71.25,38.1,93,79.1,94.5,57.3,36.2,24.5,29,30,18.8,11.8;41,218.5,71,39.8,111.7,100.5,108.3,67.1,44.2,25.2,37.5,31.5,18.7,21.3;41,247.25,73.5,42.1,117,115.6,116.1,71.2,43.3,26.3,37.3,31.7,19.7,32.3;49,191.75,65,38.4,118.5,113.1,113.8,61.9,38.3,21.9,32,29.8,17,40.1;40,202.25,70,38.5,106.5,100.9,106.2,63.5,39.9,22.6,35.1,30.6,19,24.2;50,196.75,68.25,42.1,105.6,98.8,104.8,66,41.5,24.7,33.2,30.5,19.4,28.4;46,363.15,72.25,51.2,136.2,148.1,147.7,87.3,49.1,29.6,45,29,21.4,35.2;50,203,67,40.2,114.8,108.1,102.5,61.3,41.1,24.7,34.1,31,18.3,32.6;45,262.75,68.75,43.2,128.3,126.2,125.6,72.5,39.6,26.6,36.4,32.7,21.4,34.5;44,205,29.5,36.6,106,104.3,115.5,70.6,42.5,23.7,33.6,28.7,17.4,32.9;48,217,70,37.3,113.3,111.2,114.1,67.7,40.9,25,36.7,29.8,18.4,31.6;41,212,71.5,41.5,106.6,104.3,106,65,40.2,23,35.8,31.5,18.8,32;39,125.25,68,31.5,85.1,76,88.2,50,34.7,21,26.1,23.1,16.1,7.7;43,164.25,73.25,35.7,96.6,81.5,97.2,58.4,38.2,23.4,29.7,27.4,18.3,13.9;40,133.5,67.5,33.6,88.2,73.7,88.5,53.3,34.5,22.5,27.9,26.2,17.3,10.8;39,148.5,71.25,34.6,89.8,79.5,92.7,52.7,37.5,21.9,28.8,26.8,17.9,5.6;45,135.75,68.5,32.8,92.3,83.4,90.4,52,35.8,20.6,28.8,25.5,16.3,13.6;47,127.5,66.75,34,83.4,70.4,87.2,50.6,34.4,21.9,26.8,25.8,16.8,4;47,158.25,72.25,34.9,90.2,86.7,98.3,52.6,37.2,22.4,26,25.8,17.3,10.2;40,139.25,69,34.3,89.2,77.9,91,51.4,34.9,21,26.7,26.1,17.2,6.6;51,137.25,67.75,36.5,89.7,82,89.1,49.3,33.7,21.4,29.6,26,16.9,8;49,152.75,73.5,35.1,93.3,79.6,91.6,52.6,37.6,22.6,38.5,27.4,18.5,6.3;42,136.25,67.5,37.8,87.6,77.6,88.6,51.9,34.9,22.5,27.7,27.5,18.5,3.9;54,198,72,39.9,107.6,100,99.6,57.2,38,22,35.9,30.2,18.9,22.6;58,181.5,68,39.1,100,99.8,102.5,62.1,39.6,22.5,33.1,28.3,18.5,20.4;62,201.25,69.5,40.5,111.5,104.2,105.8,61.8,39.8,22.7,37.7,30.9,19.2,28;54,202.5,70.75,40.5,115.4,105.3,97,59.1,38,22.5,31.6,28.8,18.2,31.5;61,179.75,65.75,38.4,104.8,98.3,99.6,60.6,37.7,22.9,34.5,29.6,18.5,24.6;62,216,73.25,41.4,112.3,104.8,103.1,61.6,40.9,23.1,36.2,31.8,20.2,26.1;56,178.75,68.5,35.6,102.9,94.7,100.8,60.9,38,22.1,32.5,29.8,18.3,29.8;54,193.25,70.25,38,107.6,102.4,99.4,61,39.4,23.6,32.7,29.9,19.1,30.7;61,178,67,37.4,105.3,99.7,99.7,60.8,40.1,22.7,33.6,29,18.8,25.8;57,205.5,70,40.1,105.3,105.5,108.3,65,41.2,24.7,35.3,31.1,18.4,32.3;55,183.5,67.5,40.9,103,100.3,104.2,64.8,40.2,22.7,34.8,30.1,18.7,30;54,151.5,70.75,35.6,90,83.9,93.9,55,36.1,21.7,29.6,27.4,17.4,21.5;55,154.75,71.5,36.9,95.4,86.6,91.8,54.3,35.4,21.5,32.8,27.4,18.7,13.8;54,155.25,69.25,37.5,89.3,78.4,96.1,56,37.4,22.4,32.6,28.1,18.1,6.3;55,156.75,71.5,36.3,94.4,84.6,94.3,51.2,37.4,21.6,27.3,27.1,17.3,12.9;62,167.5,71.5,35.5,97.6,91.5,98.5,56.6,38.6,22.4,31.5,27.3,18.6,24.3;55,146.75,68.75,38.7,88.5,82.8,95.5,58.9,37.6,21.6,30.3,27.3,18.3,8.8;56,160.75,73.75,36.4,93.6,82.9,96.3,52.9,37.5,23.1,29.7,27.3,18.2,8.5;55,125,64,33.2,87.7,76,88.6,50.9,35.4,19.1,29.3,25.7,16.9,13.5;61,143,65.75,36.5,93.4,83.3,93,55.5,35.2,20.9,29.4,27,16.8,11.8;61,148.25,67.5,36,91.6,81.8,94.8,54.5,37,21.4,29.3,27,18.3,18.5;57,162.5,69.5,38.7,91.6,78.8,94.3,56.7,39.7,24.2,30.2,29.2,18.1,8.8;69,177.75,68.5,38.7,102,95,98.3,55,38.3,21.8,30.8,25.7,18.8,22.2;81,161.25,70.25,37.8,96.4,95.4,99.3,53.5,37.5,21.5,31.4,26.8,18.3,21.5;66,171.25,69.25,37.4,102.7,98.6,100.2,56.5,39.3,22.7,30.3,28.7,19,18.8;67,163.75,67.75,38.4,97.7,95.8,97.1,54.8,38.2,23.7,29.4,27.2,19,31.4;64,150.25,67.25,38.1,97.1,89,96.9,54.8,38,22,29.9,25.2,17.7,26.8;64,190.25,72.75,39.3,103.1,97.8,99.6,58.9,39,23,34.3,29.6,19,18.4;70,170.75,70,38.7,101.8,94.9,95,56,36.5,24.1,31.2,27.3,19.2,27;72,168,69.25,38.5,101.4,99.8,96.2,56.3,36.6,22,29.7,26.3,18,27;67,167,67.5,36.5,98.9,89.7,96.2,54.7,37.8,33.7,32.4,27.7,18.2,26.6;72,157.75,67.25,37.7,97.5,88.1,96.9,57.2,37.7,21.8,32.6,28,18.8,14.9;64,160,65.75,36.5,104.3,90.9,93.8,57.8,39.5,23.3,29.2,28.4,18.1,23.1;46,176.75,72.5,38,97.3,86,99.3,61,38.4,23.8,30.2,29.3,18.8,8.3;48,176,73,36.7,96.7,86.5,98.3,60.4,39.9,24.4,28.8,29.6,18.7,14.1;46,177,70,37.2,99.7,95.6,102.2,58.3,38.2,22.5,29.1,27.7,17.7,20.5;44,179.75,69.5,39.2,101.9,93.2,100.6,58.9,39.7,23.1,31.4,28.4,18.8,18.2;47,165.25,70.5,37.5,97.2,83.1,95.4,56.9,38.3,22.1,30.1,28.2,18.4,8.5;46,192.5,71.75,38,106.6,97.5,100.6,58.9,40.5,24.5,33.3,29.6,19.1,24.9;47,184.25,74.5,37.3,99.6,88.8,101.4,57.4,39.6,24.6,30.3,27.9,17.8,9;53,224.5,77.75,41.1,113.2,99.2,107.5,61.7,42.3,23.2,32.9,30.8,20.4,17.4;38,188.75,73.25,37.5,99.1,91.6,102.4,60.6,39.4,22.9,31.6,30.1,18.5,9.6;50,162.5,66.5,38.7,99.4,86.7,96.2,62.1,39.3,23.3,30.6,27.8,18.2,11.3;46,156.5,68.25,35.9,95.1,88.2,92.8,54.7,37.3,21.9,31.6,27.5,18.2,17.8;47,197,72,40,107.5,94,103.7,62.7,39,22.3,35.3,30.9,18.3,22.2;49,198.5,73.5,40.1,106.5,95,101.7,59,39.4,22.3,32.2,31,18.6,21.2;48,173.75,72,37,99.1,92,98.3,59.3,38.4,22.4,27.9,26.2,17,20.4;41,172.75,71.25,36.3,96.7,89.2,98.3,60,38.4,23.2,31,29.2,18.4,20.1;49,196.75,73.75,40.7,103.5,95.5,101.6,59.1,39.8,25.4,31,30.3,19.7,22.3;43,177,69.25,39.6,104,98.6,99.5,59.5,36.1,22,30.1,27.2,17.7,25.4;43,165.5,68.5,31.1,93.1,87.3,96.6,54.7,39,24.8,31,29.4,18.8,18;43,200.25,73.5,38.6,105.2,102.8,103.6,61.2,39.3,23.5,30.5,28.5,18.1,19.3;52,203.25,74.25,42,110,101.6,100.7,55.8,38.7,23.4,35.1,29.6,19.1,18.3;43,194,75.5,38.5,110.1,88.7,102.1,57.5,40,24.8,35.1,30.7,19.2,17.3;40,168.5,69.25,34.2,97.8,92.3,100.6,57.5,36.8,22.8,32.1,26,17.3,21.4;43,170.75,68.5,37.2,96.3,90.6,99.3,61.9,38,22.3,33.3,28.2,18.1,19.7;43,183.25,70,37.1,108,105,103,63.7,40,23.6,33.5,27.8,17.4,28;47,178.25,70,40.2,99.7,95,98.6,62.3,38.1,23.9,35.3,31.1,19.8,22.1;42,163,70.25,35.3,93.5,89.6,99.8,61.5,37.8,21.9,30.7,27.6,17.4,21.3;48,175.25,71.75,38,100.7,92.4,97.5,59.3,38.1,21.8,31.8,27.3,17.5,26.7;40,158,69.25,36.3,97,86.6,92.6,55.9,36.3,22.1,29.8,26.3,17.3,16.7;48,177.25,72.75,36.8,96,90,99.7,58.8,38.4,22.8,29.9,28,18.1,20.1;51,179,72,41,99.2,90,96.4,56.8,38.8,23.3,33.4,29.8,19.5,13.9;40,191,74,38.3,95.4,92.4,104.3,64.6,41.1,24.8,33.6,29.5,18.5,25.8;44,187.5,72.25,38,101.8,87.5,101,58.5,39.2,24.5,32.1,28.6,18,18.1;52,206.5,74.5,40.8,104.3,99.2,104.1,58.5,39.3,24.6,33.9,31.2,19.5,27.9;44,185.25,71.5,39.5,99.2,98.1,101.4,57.1,40.5,23.2,33,29.6,18.4,25.3;40,160.25,68.75,36.9,99.3,83.3,97.5,60.5,38.7,22.6,34.4,28,17.6,14.7;47,151.5,66.75,36.9,94,86.1,95.2,58.1,36.5,22.1,30.6,27.5,17.6,16;50,161,66.5,37.7,98.9,84.1,94,58.5,36.6,23.5,34.4,29.2,18,13.8;46,167,67,36.6,101,89.9,100,60.7,36,21.9,35.6,30.2,17.6,17.5;42,177.5,68.75,38.9,98.7,92.1,98.5,60.7,36.8,22.2,33.8,30.3,17.2,27.2;43,152.25,67.75,37.5,95.9,78,93.2,53.5,35.8,20.8,33.9,28.2,17.4,17.4;40,192.25,73.25,39.8,103.9,93.5,99.5,61.7,39,21.8,33.3,29.6,18.1,20.8;42,165.25,69.75,38.3,96.2,87,97.8,57.4,36.9,22.2,31.6,27.8,17.7,14.9;49,171.75,71.5,35.5,97.8,90.1,95.8,57,38.7,23.2,27.5,26.5,17.6,18.1;40,171.25,70.5,36.3,94.6,90.3,99.1,60.3,38.5,23,31.2,28.4,17.1,22.7;47,197,73.25,37.8,103.6,99.8,103.2,61.2,38.1,22.6,33.5,28.6,17.9,23.6;50,157,66.75,37.8,100.4,89.4,92.3,56.1,35.6,20.5,33.6,29.3,17.3,26.1;41,168.25,69.5,36.5,98.4,87.2,98.4,56,36.9,23,34,29.8,18.1,24.4;44,186,69.75,37.8,104.6,101.1,102.1,58.9,37.9,22.7,30.9,28.8,17.6,27.1;39,166.75,70.75,37,92.9,86.1,95.6,58.8,36.1,22.4,32.7,28.3,17.1,21.8;43,187.75,74,37.7,97.8,98.6,100.6,63.6,39.2,23.8,34.3,28.4,17.7,29.4;40,168.25,71.25,34.3,98.3,88.5,98.3,58.1,38.4,22.5,31.7,27.4,17.6,22.4;49,212.75,75,40.8,104.7,106.6,107.7,66.5,42.5,24.5,35.5,29.8,18.7,20.4;40,176.75,71,37.4,98.6,93.1,101.6,59.1,39.6,21.6,30.8,27.9,16.6,24.9;40,173.25,69.5,36.5,99.5,93,99.3,60.4,38.2,22,32,28.5,17.8,18.3;52,167,67.75,37.5,102.7,91,98.9,57.1,36.7,22.3,31.6,27.5,17.9,23.3;23,159.75,72.25,35.5,92.1,77.1,93.9,56.1,36.1,22.7,30.5,27.2,18.2,9.4;23,188.15,77.5,38,96.6,85.3,102.5,59.1,37.6,23.2,31.8,29.7,18.3,10.3;24,156,70.75,35.7,92.7,81.9,95.3,56.4,36.5,22,33.5,28.3,17.3,14.2;24,208.5,72.75,39.2,102,99.1,110.1,71.2,43.5,25.2,36.1,30.3,18.7,19.2;25,206.5,69.75,40.9,110.9,100.5,106.2,68.4,40.8,24.6,33.3,29.7,18.4,29.6;25,143.75,72.5,35.2,92.3,76.5,92.1,51.9,35.7,22,25.8,25.2,16.9,5.3;26,223,70.25,40.6,114.1,106.8,113.9,67.6,42.7,24.7,36,30.4,18.4,25.2;26,152.25,69,35.4,92.9,77.6,93.5,56.9,35.9,20.4,31.6,29,17.8,9.4;26,241.75,74.5,41.8,108.3,102.9,114.4,72.9,43.5,25.1,38.5,33.8,19.6,19.6;27,146,72.25,34.1,88.5,72.8,91.1,53.6,36.8,23.8,27.8,26.3,17.4,10.1;27,156.75,67.25,37.9,94,88.2,95.2,56.8,37.4,22.8,30.6,28.3,17.9,16.5;27,200.25,73.5,38.2,101.1,100.1,105,62.1,40,24.9,33.7,29.2,19.4,21;28,171.5,75.25,35.6,92.1,83.5,98.3,57.3,37.8,21.7,32.2,27.7,17.7,17.3;28,205.75,69,38.5,105.6,105,106.4,68.6,40,25.2,35.2,30.7,19.1,31.2;28,182.5,72.25,37,98.5,90.8,102.5,60.8,38.5,25,31.6,28,18.6,10;30,136.5,68.75,35.9,88.7,76.6,89.8,50.1,34.8,21.8,27,34.9,16.9,12.5;31,177.25,71.5,36.2,101.1,92.4,99.3,59.4,39,24.6,30.1,28.2,18.2,22.5;31,151.25,72.25,35,94,81.2,91.5,52.5,36.6,21,27,26.3,16.5,9.4;33,196,73,38.5,103.8,95.6,105.1,61.4,40.6,25,31.3,29.2,19.1,14.6;33,184.25,68.75,40.7,98.9,92.1,103.5,64,37.3,23.5,33.5,30.6,19.7,13;34,140,70.5,36,89.2,83.4,89.6,52.4,35.6,20.4,28.3,26.2,16.5,15.1;34,218.75,72,39.5,111.4,106,108.8,63.8,42,23.4,34,31.2,18.5,27.3;35,217,73.75,40.5,107.5,95.1,104.5,64.8,41.3,25.6,36.4,33.7,19.4,19.2;35,166.25,68,38.5,99.1,90.4,95.6,55.5,34.2,21.9,30.2,28.7,17.7,21.8;35,224.75,72.25,43.9,108.2,100.4,106.8,63.3,41.7,24.6,37.2,33.1,19.8,20.3;35,228.25,69.5,40.4,114.9,115.9,111.9,74.4,40.6,24,36.1,31.8,18.8,34.3;35,172.75,69.5,37.6,99.1,90.8,98.1,60.1,39.1,23.4,32.5,29.8,17.4,16.5;35,152.25,67.75,37,92.2,81.9,92.8,54.7,36.2,22.1,30.4,27.4,17.7,3;35,125.75,65.5,34,90.8,75,89.2,50,34.8,22,24.8,25.9,16.9,0.7;35,177.25,71,38.4,100.5,90.3,98.7,57.8,37.3,22.4,31,28.7,17.7,20.5;36,176.25,71.5,38.7,98.2,90.3,99.9,59.2,37.7,21.5,32.4,28.4,17.8,16.9;36,226.75,71.75,41.5,115.3,108.8,114.4,69.2,42.4,24,35.4,21,20.1,25.3;37,145.25,69.25,36,96.8,79.4,89.2,50.3,34.8,22.2,31,26.9,16.9,9.9;37,151,67,35.3,92.6,83.2,96.4,60,38.1,22,31.5,26.6,16.7,13.1;37,241.25,71.5,42.1,119.2,110.3,113.9,69.8,42.6,24.8,34.4,29.5,18.4,29.9;38,187.25,69.25,38,102.7,92.7,101.9,64.7,39.5,24.7,34.8,30.3,18.1,22.5;39,234.75,74.5,42.8,109.5,104.5,109.9,69.5,43.1,25.8,39.1,32.5,19.9,16.9;39,219.25,74.25,40,108.5,104.6,109.8,68.1,42.8,24.1,35.6,29,19,26.6;40,118.5,68,33.8,79.3,69.4,85,47.2,33.5,20.2,27.7,24.6,16.5,0;40,145.75,67.25,35.5,95.5,83.6,91.6,54.1,36.2,21.8,31.4,28.3,17.2,11.5;40,159.25,69.75,35.3,92.3,86.8,96.1,58,39.4,22.7,30,26.4,17.4,12.1;40,170.5,74.25,37.7,98.9,90.4,95.5,55.4,38.9,22.4,30.5,28.9,17.7,17.5;40,167.5,71.5,39.4,89.5,83.7,98.1,57.3,39.7,22.6,32.9,29.3,18.2,8.6;41,232.75,74.25,41.9,117.5,109.3,108.8,67.7,41.3,24.7,37.2,31.8,20,23.6;41,210.5,72,38.5,107.4,98.9,104.1,63.5,39.8,23.5,36.4,30.4,19.1,20.4;41,202.25,72.5,40.8,109.2,98,101.8,62.8,41.3,24.8,36.6,32.4,18.8,20.5;41,185,68.25,38,103.4,101.2,103.1,61.5,40.4,22.9,33.4,29.2,18.5,24.4;41,153,69.25,36.4,91.4,80.6,92.3,54.3,36.3,21.8,29.6,27.3,17.9,11.4;42,244.25,76,41.8,115.2,113.7,112.4,68.5,45,25.5,37.1,31.2,19.9,38.1;42,193.5,70.5,40.7,104.9,94.1,102.7,60.6,38.6,24.7,34,30.1,18.7,15.9;42,224.75,74.75,38.5,106.7,105.7,111.8,65.3,43.3,26,33.7,29.9,18.5,24.7;42,162.75,72.75,35.4,92.2,85.6,96.5,60.2,38.9,22.4,31.7,27.1,17.1,22.8;42,180,68.25,38.5,101.6,96.6,100.6,61.1,38.4,24.1,32.9,29.8,18.8,25.5;42,156.25,69,35.5,97.8,86,96.2,57.7,38.6,24,31.2,27.3,17.4,22;42,168,71.5,36.5,92,89.7,101,62.3,38,22.3,30.8,27.8,16.9,17.7;42,167.25,72.75,37.6,94,78,99,57.5,40,22.5,30.6,30,18.5,6.6;43,170.75,67.5,37.4,103.7,89.7,94.2,58.5,39,24.1,33.8,28.8,18.8,23.6;43,178.25,70.25,37.8,102.7,89.2,99.2,60.2,39.2,23.8,31.7,28.4,18.6,12.2;43,150,69.25,35.2,91.1,85.7,96.9,55.5,35.7,22,29.4,26.6,17.4,22.1;43,200.5,71.5,37.9,107.2,103.1,105.5,68.8,38.3,23.7,32.1,28.9,18.7,28.7;44,184,74,37.9,100.8,89.1,102.6,60.6,39,24,32.9,29.2,18.4,6;44,223,69.75,40.9,121.6,113.9,107.1,63.5,40.3,21.8,34.8,30.7,17.4,34.8;44,208.75,73,41.9,105.6,96.3,102,63.3,39.8,24.1,37.3,23.1,19.4,16.6;44,166,65.5,39.1,100.6,93.9,100.1,58.9,37.6,21.4,33.1,29.5,17.3,32.9;47,195,72.5,40.2,102.7,101.3,101.7,60.7,39.4,23.3,36.7,31.6,18.4,32.8;47,160.5,70.25,36,99.8,83.9,91.8,53,36.2,22.5,31.4,27.5,17.7,9.6;47,159.75,70.75,34.5,92.9,84.4,94,56,38.2,22.6,29,26.2,17.6,10.8;49,140.5,68,35.8,91.2,79.4,89,51.1,35,21.7,30.9,28.8,17.4,7.1;49,216.25,74.5,40.2,115.6,104,109,63.7,40.3,23.2,36.8,31,18.9,27.2;49,168.25,71.75,38.3,98.3,89.7,99.1,56.3,38.8,23,29.5,27.9,18.6,19.5;50,194.75,70.75,39,103.7,97.6,104.2,60,40.9,25.5,32.7,30,19,18.7;50,172.75,73,37.4,98.7,87.6,96.1,57.1,38.1,21.8,28.6,26.7,18,19.5;51,219,64,41.2,119.8,122.1,112.8,62.5,36.9,23.6,34.7,29.1,18.4,47.5;51,149.25,69.75,34.8,92.8,81.1,96.3,53.8,36.5,21.5,31.3,26.3,17.8,13.6;51,154.5,70,36.9,93.3,81.5,94.4,54.7,39,22.6,27.5,25.9,18.6,7.5;52,199.25,71.75,39.4,106.8,100,105,63.9,39.2,22.9,35.7,30.4,19.2,24.5;53,154.5,69.25,37.6,93.9,88.7,94.5,53.7,36.2,22,28.5,25.7,17.1,15;54,153.25,70.5,38.5,99,91.8,96.2,57.7,38.1,23.9,31.4,29.9,18.9,12.4;54,230,72.25,42.5,119.9,110.4,105.5,64.2,42.7,27,38.4,32,19.6,26;54,161.75,67.5,37.4,94.2,87.6,95.6,59.7,40.2,23.4,27.9,27,17.8,11.5;55,142.25,67.25,35.2,92.7,82.8,91.9,54.4,35.2,22.5,29.4,26.8,17,5.2;55,179.75,68.75,41.1,106.9,95.3,98.2,57.4,37.1,21.8,34.1,31.1,19.2,10.9;55,126.5,66.75,33.4,88.8,78.2,87.5,50.8,33,19.7,25.3,22,15.8,12.5;55,169.5,68.25,37.2,101.7,91.1,97.1,56.6,38.5,22.6,33.4,29.3,18.8,14.8;55,198.5,74.25,38.3,105.3,96.7,106.6,64,42.6,23.4,33.2,30,18.4,25.2;56,174.5,69.5,38.1,104,89.4,98.4,58.4,37.4,22.5,34.6,30.1,18.8,14.9;56,167.75,68.5,37.4,98.6,93,97,55.4,38.8,23.2,32.4,29.7,19,17;57,147.75,65.75,35.2,99.6,86.4,90.1,53,35,21.3,31.7,27.3,16.9,10.6;57,182.25,71.75,39.4,103.4,96.7,100.7,59.3,38.6,22.8,31.8,29.1,19,16.1;58,175.5,71.5,38,100.2,88.1,97.8,57.1,38.9,23.6,30.9,29.6,18,15.4;58,161.75,67.25,35.1,94.9,94.9,100.2,56.8,35.9,21,27.8,26.1,17.6,26.7;60,157.75,67.5,40.4,97.2,93.3,94,54.3,35.7,21,31.3,28.7,18.3,25.8;62,168.75,67.5,38.3,104.7,95.6,93.7,54.4,37.1,22.7,30.3,26.3,18.3,18.6;62,191.5,72.25,40.6,104,98.2,101.1,59.3,40.3,23,32.6,28.5,19,24.8;63,219.15,69.5,40.2,117.6,113.8,111.8,63.4,41.1,22.3,35.1,29.6,18.5,27.3;64,155.25,69.5,37.9,95.8,82.8,94.5,61.2,39.1,22.3,29.8,28.9,18.3,12.4;65,189.75,65.75,40.8,106.4,100.5,100.5,59.2,38.1,24,35.9,30.5,19.1,29.9;65,127.5,65.75,34.7,93,79.7,87.6,50.7,33.4,20.1,28.5,24.8,16.5,17;65,224.5,68.25,38.8,119.6,118,114.3,61.3,42.1,23.4,34.9,30.1,19.4,35;66,234.25,72,41.4,119.7,109,109.1,63.7,42.4,24.6,35.6,30.7,19.5,30.4;67,227.75,72.75,41.3,115.8,113.4,109.8,65.6,46,25.4,35.3,29.8,19.5,32.6;67,199.5,68.5,40.7,118.3,106.1,101.6,58.2,38.8,24.1,32.1,29.3,18.5,29;68,155.5,69.25,36.3,97.4,84.3,94.4,54.3,37.5,22.6,29.2,27.3,18.5,15.2;69,215.5,70.5,40.8,113.7,107.6,110,63.3,44,22.6,37.5,32.6,18.8,30.2;70,134.25,67,34.9,89.2,83.6,88.8,49.6,34.8,21.5,25.6,25.7,18.5,11;72,201,69.75,40.9,108.5,105,104.5,59.6,40.8,23.2,35.2,28.6,20.1,33.6;72,186.75,66,38.9,111.1,111.5,101.7,60.3,37.3,21.5,31.3,27.2,18,29.3;72,190.75,70.5,38.9,108.3,101.3,97.8,56,41.6,22.7,30.5,29.4,19.8,26;74,207.5,70,40.8,112.4,108.5,107.1,59.3,42.2,24.6,33.7,30,20.9,31.9";

const ROWS = RAW.split(";").map((s) => s.split(",").map(Number));
const N = ROWS.length;
const P = COLS.length;

/* --- everything the fit needs, precomputed once -------------------------- *
 * Standardising is not cosmetic here: a penalty on raw coefficients would
 * penalise a measurement for the units it was taken in. The notebook's own
 * pipeline standardises for the same reason.
 *
 * The solver then works from the Gram matrix rather than from the 252 rows, so
 * a refit is 13x13 per sweep instead of 252x13 — which is what makes dragging a
 * dial cheap enough to do inside compute().                                  */
const colMean = (f) => ROWS.reduce((s, r) => s + f(r), 0) / N;
const MU = COLS.map((_, j) => colMean((r) => r[j]));
const SD = COLS.map((_, j) => Math.sqrt(colMean((r) => (r[j] - MU[j]) ** 2)) || 1);
const X = ROWS.map((r) => COLS.map((_, j) => (r[j] - MU[j]) / SD[j]));
const Y_RAW = ROWS.map((r) => r[P]);
const Y_MEAN = Y_RAW.reduce((s, v) => s + v, 0) / N;
const Y = Y_RAW.map((v) => v - Y_MEAN);
const GRAM = COLS.map((_, a) => COLS.map((_, b) => X.reduce((s, x) => s + x[a] * x[b], 0) / N));
const XY = COLS.map((_, a) => X.reduce((s, x, i) => s + x[a] * Y[i], 0) / N);
const Y_VAR = Y.reduce((s, v) => s + v * v, 0) / N;

/**
 * Coordinate descent on the elastic net, sklearn's Lasso convention.
 * Two variables or thirteen, the update is the same soft-threshold: this is the
 * ONE place the fit is written, and the plane's slice calls it too rather than
 * carrying a second copy of the same algebra.
 */
function coordinateDescent(gram, xy, a1, a2, sweeps) {
  const k = xy.length;
  const w = new Array(k).fill(0);
  for (let it = 0; it < sweeps; it += 1) {
    for (let j = 0; j < k; j += 1) {
      let rho = xy[j];
      for (let m = 0; m < k; m += 1) if (m !== j) rho -= gram[j][m] * w[m];
      w[j] = (Math.max(Math.abs(rho) - a1, 0) * Math.sign(rho)) / (1 + a2);
    }
  }
  return w;
}

const fitAll = (a1, a2) => coordinateDescent(GRAM, XY, a1, a2, 300);
const OLS = fitAll(0, 0);

function rSquared(w) {
  let quad = 0;
  for (let a = 0; a < P; a += 1) for (let b = 0; b < P; b += 1) quad += w[a] * GRAM[a][b] * w[b];
  const rss = quad - 2 * w.reduce((s, v, j) => s + v * XY[j], 0) + Y_VAR;
  return 1 - rss / Y_VAR;
}

/* The ladder. A `choice` slider rather than a float, because these are a
   MAGNITUDE (3.3) and a bare float slider shows a position while hiding the
   positions. Both dials share one ladder so the table's symmetry is visible. */
const ALPHAS = [0, 0.01, 0.03, 0.1, 0.3, 1, 3];
const alphaOf = (key) => ALPHAS[Number(key)] ?? 0;

/* WHAT EACH SETTING ACTUALLY DOES, measured rather than described. The details
   used to read "a diamond of the size that reaches this fit", which says nothing
   the tick label does not: the diamond's size IS whatever the fit turned out to
   be, so the sentence defines the setting by its own consequence and repeats
   verbatim for every non-zero value.

   These state the consequence as a count instead, and they are computed from the
   solver above rather than typed in, so they cannot drift from the model (5.8).
   Fourteen fits at load, each 13x13 per sweep — unmeasurable.

   "alone" is the qualifier doing real work: each number holds with the OTHER
   dial at zero, which is the path the option is about. It is also the contrast
   the widget exists for — one column of counts falls, the other never does. */
const L1_SURVIVORS = ALPHAS.map((a) => fitAll(a, 0).filter((v) => Math.abs(v) > 1e-9).length);
const L2_LARGEST = ALPHAS.map((a) => Math.max(...fitAll(0, a).map(Math.abs)));

/* EVERY PAIR SHARES ABDOMEN, and the partner is what the reader picks. Two
   reasons. The plane's horizontal axis then never moves, so switching partners
   compares like with like instead of redrawing the whole frame (2.5). And the
   partners are ordered by their correlation with Abdomen, which makes the
   control a MAGNITUDE — left to right is more elongated to less — so it is a
   slider with tick labels rather than four buttons (3.3).

   Weight/Hip is the most elongated pair in the data at 5.69:1 and is left out
   for this: it shares neither axis, and four segment buttons reading
   "Abdome…" / "Weight …" / "Abdome…" / "Abdome…" told the reader nothing. */
/* EVERY ORDERED PAIR, and the matrix is how you reach them. Thirteen
   measurements make 169 cells, 13 of them the diagonal, so 156 pairs. The four
   that a slider could offer spanned elongations 1.09:1 to 4.77:1; the full set
   runs 1.01:1 (Age against Weight, r = 0.013 — contours so nearly circular that
   the diamond and the circle become the same shape) to 5.73:1 (Weight against
   Hip). The case where the L1/L2 distinction stops mattering is only reachable
   here.

   ORDERED, not unordered: (i, j) and (j, i) are the same two measurements with
   the axes swapped, and which one is horizontal is a real difference on screen.

   The value is `x~y`, x horizontal. It is one parameter, not two — a region may
   set exactly one, and a pair of variables is one fact about the figure. */
const PAIR_SEP = "~";
const pairKey = (a, b) => `${a}${PAIR_SEP}${b}`;
const PAIRS = [];
for (const a of COLS) for (const b of COLS) if (a !== b) PAIRS.push({ key: pairKey(a, b), a, b });
const pairOf = (key) => PAIRS.find((p) => p.key === key) ?? PAIRS[0];
const elongation = (r) => Math.sqrt((1 + r) / (1 - r));
const corrOf = (a, b) => GRAM[COLS.indexOf(a)][COLS.indexOf(b)];

/** Which cell of the notebook's table these two dials land in. */
function tableCell(a1, a2) {
  if (a1 <= 0 && a2 <= 0) return "Linear";
  if (a1 <= 0) return "Ridge";
  if (a2 <= 0) return "Lasso";
  return "ElasticNet";
}

/* --- compute ------------------------------------------------------------- */

function computeAll({ params }) {
  const a1 = alphaOf(params.a1);
  const a2 = alphaOf(params.a2);
  const w = fitAll(a1, a2);
  const pair = pairOf(params.pair);
  const ia = COLS.indexOf(pair.a);
  const ib = COLS.indexOf(pair.b);

  /* The conditional slice: hold the other eleven where they were fitted. What
     is left is a two-variable problem with the SAME shape as a two-feature fit,
     but centred on a point that knows about the other eleven. */
  /* ONE function, two coefficient vectors. It was written twice — once reading
     the live fit, once reading OLS — which is exactly the shape 5.8 warns about:
     two copies of an identity, and a comment to keep them in step. */
  const rest = (v, j) => {
    let s = 0;
    for (let m = 0; m < P; m += 1) if (m !== ia && m !== ib) s += GRAM[j][m] * v[m];
    return s;
  };
  const r = GRAM[ia][ib];
  const cxy = [XY[ia] - rest(w, ia), XY[ib] - rest(w, ib)];
  const gram2 = [[1, r], [r, 1]];

  /* The route from unpenalised to here, drawn in the slice. Solved in the slice
     rather than sampled from full refits, so every point on it is a point of
     the same picture the solution sits in. */
  const trail = [];
  for (let i = 0; i <= 44; i += 1) {
    const f = i / 44;
    trail.push(coordinateDescent(gram2, cxy, a1 * f, a2 * f, 200));
  }

  /* The slice's own unpenalised point: where this pair would sit if the penalty
     came off THESE TWO, the other eleven left where they are. It is the centre
     of the contours, so the tangency is measured against it — and it moves as
     the dials move, because the other eleven genuinely do shrink.

     This is ALSO the ellipse centre. It was computed a second time in closed
     form from the same `cxy`, which agreed to 1.3e-14 and was two algorithms for
     one quantity (5.8). The solver is kept because it is the one place the fit
     is written. */
  const centre = coordinateDescent(gram2, cxy, 0, 0, 200);
  const unpenalised = centre;

  /* THE FRAME IS FIXED BY THE PAIR, NOT BY THE DIALS (2.5). Conditioning it on
     the live eleven is what the first build did, and the panel then drifted
     under the reader as they dragged: the contours slid off one edge and the
     ellipse centre left the frame entirely.

     The anchor is just the pair's OLS entries. That was originally reached by
     re-solving the slice against the unpenalised eleven — provably the same
     thing, because OLS is coordinate-wise optimal, so a slice conditioned on
     unpenalised coefficients hands the unpenalised pair straight back. Checked:
     worst disagreement 1.1e-14 over every pair. */
  const anchor = [OLS[ia], OLS[ib]];
  const reach = Math.max(Math.abs(anchor[0]), Math.abs(anchor[1]), 1);

  const barLimit = Math.max(4, Math.ceil(Math.max(...OLS.map(Math.abs)) / 4) * 4);

  return {
    a1, a2, w, pair, ia, ib, r, centre, trail, unpenalised,
    span: Math.max(4, reach * 2.4),
    focus: [anchor[0] / 2, anchor[1] / 2],
    kept: w.filter((v) => Math.abs(v) > 1e-9).length,
    /* THE GROUPING EFFECT, AS A NUMBER. Raising a2 at a fixed a1 puts
       coefficients BACK — 9 of 13 up to all 13 on this data — which reads as a
       bug and is not one. L2 stops the correlated measurements sharing one
       coefficient between them, and once separated each one's own covariance
       with body fat clears the L1 threshold: the smallest here is Height at
       -0.75 against a threshold of 0.1. Verified converged, 300 sweeps against
       20,000 agreeing to machine zero. Naming it in counts is cheaper than a
       caption and does not editorialise (2.9). */
    keptL1Only: fitAll(a1, 0).filter((v) => Math.abs(v) > 1e-9).length,
    r2: rSquared(w),
    cell: tableCell(a1, a2),
    barLimit,
    /* Predictions in the outcome's own units, so the data panel reads in body
       fat percent rather than in standardised anything. */
    predicted: X.map((x) => Y_MEAN + x.reduce((s, v, j) => s + v * w[j], 0)),
  };
}

/* --- the layout, and the height that follows from it ---------------------- *
 * THE TWO PANELS ARE SQUARE AND THAT IS NOT NEGOTIABLE. The plane's claim is
 * that only the diamond has corners; at unequal scales the L1 ball is not drawn
 * as a diamond and the L2 ball is not drawn as a circle, so the sentence in the
 * subtitle and the picture would disagree. The predictions panel is measured
 * against predicted in the same units, so `y = x` is only at 45 degrees while it
 * is square too.
 *
 * Square means WIDER COSTS TALLER, so the canvas height is a function of the
 * width rather than a number. It was 438 with `side` capped at 228, which left
 * 206px of the row empty at the wide frame — the bars ran the full width and the
 * two squares stopped well short of them. Mocked as P3 of four in
 * `_lab/linreg-panel-width.html`: at the wide frame the plane goes 228 -> 331px,
 * 45% more of the panel the whole tangency argument lives in, and at the narrow
 * frame nothing changes at all because the panels are already width-bound there.
 *
 * The alternative that was drawn and rejected is P4, narrowing the bars and the
 * equation to the panels instead: it removes the ragged edge by wasting MORE of
 * the row, not less.                                                          */
const PAD_L = 48, PAD_R = 16;
const BAR_TOP = 14, BAR_H = 112;
const ROW_TOP = BAR_TOP + BAR_H + 50;
const ROW_GAP = 44;      /* between the two squares — room for the y axis label */
const ROW_BOTTOM = 34;   /* the x axis label under them */

const panelSide = (w) => (w - PAD_L - PAD_R - ROW_GAP) / 2;
const canvasHeight = ({ w }) => ROW_TOP + panelSide(w) + ROW_BOTTOM;

/* --- where the correlation matrix went ------------------------------------
 * IT IS A CONTROL, AND IT IS NOW IN THE RAIL — core's `matrix` type, declared
 * in `params` below. It was drawn on the canvas first, beside the bars, and
 * four placements were mocked up before that; `_lab/linreg-matrix-rail.html`
 * holds the comparison and the numbers.
 *
 * WHAT MOVED IT was one measurement nobody had taken: the rail is 444px against
 * a 654px stage, so it had 210px of slack, and it is 300px wide against the
 * 150px the canvas could spare. The grid is twice the size in the rail. Cells
 * went from 11.5px to 17.8px even after the thirteen names took their 54px.
 *
 * WHAT IT COSTS, named here because 5.6 says a blind spot must be. The rail is
 * outside BOTH fingerprint hashes on purpose — `px` hashes the canvas and `tx`
 * reads the figure's text, and a control's own label is not a reading of the
 * figure. So the grid's geometry is covered by neither, where on the canvas it
 * was at least inside `px`. What replaces that cover is the `matrix` control
 * being CORE: one implementation, exercised by every widget that ever declares
 * one, rather than thirteen-by-thirteen arithmetic written twice in this file.
 *
 * The canvas hit-testing this used — `regions`, `pointAt`, `hitTest` — stays in
 * core and is not orphaned: SVM's support vectors and the tree widget's nodes
 * are figure-native and cannot move to a rail.
 * ========================================================================= */

/* --- the fitted model, as MathML ------------------------------------------ *
 * Not the objective — the MODEL, with the weights in it. A term at exactly zero
 * is not written at all, which is the whole reason to show it: the equation is
 * as long as the model is big. Raising a1 shortens it from three lines to one;
 * raising a2 never shortens it, because L2 cannot reach zero. That contrast is
 * the widget's claim, stated in the length of a line of text.
 *
 * ---------------------------------------------------------------------------
 * WHY IT LEFT THE CANVAS, AND WHAT THAT COSTS.
 *
 * Drawn as unicode it read as prose, not as maths: `z` and `Abdomen` were the
 * same kind of glyph, and the spacing round + and − was whatever the interface
 * font gives a plus sign in a sentence. MathML gets the typographic rule right
 * without being told — MathML Core sets `text-transform: math-auto` on <mi>,
 * which italicises a single-letter identifier and leaves a multi-letter one
 * upright, so `z` is a variable and `Abdomen` is a name. It also makes the
 * definition of z a real fraction instead of a division sign, and it is read by
 * screen readers as an expression they can step through rather than as a flat
 * string — canvas text is read as nothing at all.
 *
 * THE COST IS NAMED HERE BECAUSE PRINCIPLE 5.6 SAYS A BLIND SPOT MUST BE, never
 * cited as safety. The equation now leaves BOTH cheap checks in the repo:
 *
 *   1. `_lab/fingerprint.html` hashes the CANVAS. Thirteen coefficients stop
 *      being covered by any of the 105 states.
 *   2. The canvas text sweep works by wrapping `fillText`. The equation stops
 *      going through `fillText`, so the sweep silently stops seeing it — no
 *      error, no gap in its output, just thirteen fewer strings in a list
 *      nobody counts.
 *
 * So a flipped sign or a coefficient off by a factor would now ship with the
 * canvas hash still reporting MATCH. The floor that closes it is a textContent
 * check in the harness. It was BUILT afterwards — every state now carries a `tx`
 * hash over `.w-math`, `.w-legend` and `.w-readout` — but it closes nothing here
 * until this widget has fingerprint states of its own, and it has none.
 *
 * ---------------------------------------------------------------------------
 * MathML Core is Baseline since January 2023 and the floor is Chrome/Edge 109.
 * An older engine does not fail tidily: it drops the <math> wrapper and renders
 * the tokens run together — "body fat %=19.2 +0.78 z(Age)" with the invisible
 * times character showing. So support is PROBED, and the plain-text equation is
 * rendered instead when the probe fails.
 * ========================================================================= */

/**
 * A CAPABILITY TEST, NOT AN INTERFACE TEST. `window.MathMLElement` says the DOM
 * interface is defined; it does not say the layout engine stacks a fraction. So
 * measure one — an <mfrac> must be markedly taller than a plain <mn>.
 *
 * Both sides must be <math>. Comparing the <mfrac> against a <span> wrapping a
 * <math> measures the span's line-height instead and reports a browser that
 * lays maths out perfectly as one that does not, which would force the fallback
 * on every reader for ever.
 */
function mathmlRenders() {
  if (typeof window.MathMLElement !== "function") return false;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;font-size:16px";
  probe.innerHTML = '<math id="lr-frac"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>'
    + '<math id="lr-flat"><mn>1</mn></math>';
  document.body.appendChild(probe);
  const h = (id) => probe.querySelector(`#${id}`)?.getBoundingClientRect().height ?? 0;
  const stacked = h("lr-frac"), flat = h("lr-flat");
  probe.remove();
  return flat > 0 && stacked > flat * 1.4;
}
const MATHML = mathmlRenders();

/* TWO DECIMALS, UNLESS TWO DECIMALS SAY ZERO. Four of the 637 reachable
   coefficient slots sit between 0.002 and 0.005 — at a1 = a2 = 0.01 the Knee
   coefficient is -0.005 — and `toFixed(2)` printed them as "0.00", so the
   equation read "− 0.00 z(Knee)": subtract zero times Knee. A term that is in
   the model is written with enough digits to show that it is. */
function coefText(v) {
  const two = Math.abs(v).toFixed(2);
  return two === "0.00" ? Math.abs(v).toFixed(3) : two;
}

const NAMED = (t) => `<mi mathvariant="normal">${t}</mi>`;

/* ONE <math> PER TERM. A single <math> does not line-break — MathML Core treats
   `white-space` as `nowrap` on every MathML element, automatic linebreaking was
   left out of the spec, and no engine implements it, so thirteen terms in one
   <math> measure past 1000px and simply overflow. Separate inline <math>
   elements with real whitespace between them are atomic inline boxes in an
   ordinary inline formatting context, so the line breaker can break at the
   seams. The break opportunities are exactly the ones authored here.

   AND THAT IS WHY EVERY SIGN CARRIES form="infix". One <math> per term makes
   each leading + or - the FIRST CHILD of its row, so MathML sets it as a PREFIX
   operator — unary minus, no spacing — rather than as the infix + it is. The
   attribute restores 7.1px per term, measured, and it is most of the difference
   between this reading as a sum and reading as a run-on string.

   THE MEASUREMENT IS A SUBSCRIPT AND THE TIMES IS VISIBLE: z_Age rather than
   z(Age), and a multiplication sign rather than the invisible-times character.
   Twenty-six parentheses leave the equation, and what replaces them says
   outright that a coefficient multiplies a measurement — which is what a linear
   model IS. Chosen as T4 from five candidates drawn at the real 546px block
   width in `_lab/equation-terms.html`. It still fits thirteen terms in the three
   reserved lines; T5, parentheses plus a dot, needed a fourth. */
function equationHTML(w) {
  const parts = [`<math><mrow>${NAMED("body&#xA0;fat&#xA0;%")}<mo>=</mo>`
    + `<mn>${Y_MEAN.toFixed(1)}</mn></mrow></math>`];
  for (let j = 0; j < P; j += 1) {
    if (Math.abs(w[j]) < 1e-9) continue;
    parts.push(`<math><mrow><mo form="infix">${w[j] < 0 ? "&#x2212;" : "+"}</mo>`
      + `<mn>${coefText(w[j])}</mn><mo>&#xD7;</mo>`
      + `<msub><mi>z</mi>${NAMED(COLS[j])}</msub></mrow></math>`);
  }
  return parts.join(" ");
}

/* The general definition rather than a description of one. A reader who has
   only been told "in standard deviations from its mean" cannot compute one.

   SUBSCRIPTED, because the equation above it is. A note defining z(x) over an
   equation written in z_Age asks the reader to bridge two notations for one
   quantity before they have been told it is one quantity. */
const Z_DEF = `<math><mrow><msub><mi>z</mi><mi>x</mi></msub><mo>=</mo><mfrac>`
  + `<mrow><mi>x</mi><mo>&#x2212;</mo><mover><mi>x</mi><mo>&#xAF;</mo></mover></mrow>`
  + `<mi>s</mi></mfrac></mrow></math>`;

const Z_DEF_PLAIN = "z_x = (x − mean of x) ÷ SD of x";

function plainEquation(w) {
  let out = `body fat % = ${Y_MEAN.toFixed(1)}`;
  for (let j = 0; j < P; j += 1) {
    if (Math.abs(w[j]) < 1e-9) continue;
    out += ` ${w[j] < 0 ? "−" : "+"} ${coefText(w[j])} × z_${COLS[j]}`;
  }
  return out;
}

/* MOUNTED LAZILY, FROM INSIDE draw(), AND SCOPED TO THE WIDGET'S OWN HOST.
   `buildShell` creates `.w-figure` synchronously inside `defineWidget`, so this
   file's module scope runs BEFORE it exists — mounting there queries null and
   throws, and the reader gets a blank page rather than a missing equation.
   draw() is the first hook that runs after the shell is built, and it is also
   the only per-change signal a widget gets without a core change.

   MEMOISED because paint() runs per frame and rebuilding fourteen <math>
   elements costs ~0.7ms against the 0.004ms of the fillText line it replaces.
   The key is the coefficients themselves: all 49 reachable fits produce a
   distinct key, checked. */
let mathHost = null;
let mathKey = null;

function renderEquation(w) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    const note = document.createElement("p");
    note.className = "w-math-note";
    note.innerHTML = MATHML ? Z_DEF : Z_DEF_PLAIN;
    mathHost.append(document.createElement("div"), note);
    mathHost.firstChild.className = "w-math-eq";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  const key = w.map((v) => coefText(v) + (v < 0 ? "-" : "+")).join(",");
  if (key === mathKey) return;
  mathKey = key;
  const eq = mathHost.querySelector(".w-math-eq");
  if (MATHML) eq.innerHTML = equationHTML(w);
  else eq.textContent = plainEquation(w);
}

/* --- draw ---------------------------------------------------------------- */

defineWidget({
  slug: "linear-regularization",
  title: "Linear Models and Regularization",
  subtitle:
    "Ridge, lasso and elastic net are one objective with two penalty dials. α₁ draws a "
    + "diamond around the origin and α₂ draws a circle, and only the diamond has corners "
    + "— which is why only it sets a coefficient to exactly zero.",
  layout: "side",
  status: "shipped",
  height: canvasHeight,

  params: {
    /* THE TWO DIALS, IN THE TABLE'S OWN ORDER. Each is a data parameter: it
       changes what the coefficients ARE. */
    a1: {
      type: "choice",
      label: "α₁ — the L1 penalty",
      options: ALPHAS.map((v, i) => ({
        value: String(i),
        label: v === 0 ? "0" : String(v),
        detail: v === 0
          ? "0 — no L1 term; nothing reaches zero"
          : `${v} — alone, ${L1_SURVIVORS[i]} of the 13 survive`,
      })),
      default: "0",
    },
    a2: {
      type: "choice",
      label: "α₂ — the L2 penalty",
      options: ALPHAS.map((v, i) => ({
        value: String(i),
        label: v === 0 ? "0" : String(v),
        /* The zero option is the one the widget OPENS on, and it used to be the
           only detail long enough to wrap — 59 characters against 46 — so the
           rail jogged 16px every time the reader dragged this dial across zero
           and everything below it moved. Kept under one line, like the rest
           (3.4d, in a paragraph rather than a button). */
        detail: v === 0
          ? "0 — no L2 term; nothing shrinks"
          : `${v} — alone, all 13 survive; largest ${fmt(L2_LARGEST[i], 1)}`,
      })),
      default: "0",
    },

    /* THE FOUR NAMES, IN THE RAIL RATHER THAN ON THE FIGURE. It reports the two
       dials directly above it, and principle 2.7 puts a reading next to what
       produced it — the dials produce this, the figure does not. Drawn on the
       canvas first, where it sat beside a panel it was not describing, and where
       it was painted over the Forearm and Wrist bars and only looked clear
       because those two coefficients happen to be small.

       It carries no value and never reaches the URL: the two dials already
       determine it completely, so storing it would be a second state of record
       for something that is a function of the first. */
    kind: {
      type: "readback",
      label: "",
      cols: ["α₁ = 0", "α₁ > 0"],
      rows: ["α₂ = 0", "α₂ > 0"],
      cells: [["Linear", "Lasso"], ["Ridge", "ElasticNet"]],
      live: (v) => [alphaOf(v.a2) > 0 ? 1 : 0, alphaOf(v.a1) > 0 ? 1 : 0],
    },

    /* WHICH TWO OF THE THIRTEEN THE PLANE HOLDS. Display, because it changes no
       coefficient: the model is the same thirteen numbers whichever pair is on
       the plane. The idea it carries is the elongation — how correlated the two
       measurements are is what decides whether the penalty's shape matters. */
    /* THE MATRIX ITSELF, AS THE CONTROL. All 156 ordered pairs on one grid, the
       column the horizontal measurement and the row the vertical — the same way
       round as the plane the cell sets, so dragging your eye across the grid is
       dragging it along the plane's x axis.

       ALL 156, NOT 78. `(i, j)` and `(j, i)` are the same two measurements with
       the axes swapped, and which one is horizontal is a real difference on
       screen: the pair reaches elongations from 1.01:1 (Age against Weight,
       r = 0.013, contours so nearly circular that the diamond and the circle
       become the same shape — the case where the L1/L2 distinction stops
       mattering) to 5.73:1 (Weight against Hip). The four-pair slider this
       replaced reached 1.09–4.77 and neither end.

       IT REPLACED A 156-OPTION DROPDOWN, which is why it can be the only route
       rather than a shortcut: the grid takes focus once and the arrow keys move
       the selection, so 3.6 is satisfied by the control itself instead of by a
       parallel one. Two controls for one parameter was measured too — the
       dropdown's 66px of rail is the difference between a grid SMALLER than the
       canvas's and one half again bigger.

       Display, because it changes no coefficient: the model is the same thirteen
       numbers whichever pair is on the plane. What it carries is the elongation,
       and how correlated two measurements are is what decides whether the
       penalty's shape matters at all. */
    pair: {
      type: "matrix",
      label: "Pair on the plane",
      rows: COLS,
      cols: COLS,
      token: "empirical",
      options: PAIRS.map((p) => ({
        value: p.key,
        label: `${p.a} against ${p.b}`,
        detail: `${p.a} against ${p.b} · r = ${fmt(corrOf(p.a, p.b), 2)}`,
        col: COLS.indexOf(p.a),
        row: COLS.indexOf(p.b),
        shade: Math.abs(corrOf(p.a, p.b)),
      })),
      default: pairKey("Abdomen", "Chest"),
      display: true,
    },

    /* NAMES THE MARK, PROMISES NO MOTION. "Show the route from the unpenalised
       fit" reads as an offer of something to watch, and at the opening state
       there is nothing: with both dials at zero you ARE the unpenalised fit, so
       every point of the route is the same point. Naming the endpoint instead is
       true at every setting, including that one.

       Its `detail` is gone rather than reworded — `detail` is not rendered for a
       `bool` at all, so the line was dead copy nobody could ever read. That is a
       gap in core's `bools` branch, not in this widget, and it is left for its
       own change. */
    trail: {
      type: "bool",
      label: "The route from α₁ = α₂ = 0",
      default: true,
      display: true,
    },
  },

  /* Two level sets meeting is what the tangency picture IS, so the two of them
     are named as a pair — equal squared error against equal penalty. The earlier
     "What the penalty allows" personified the penalty and named no quantity
     (2.9); a penalty is a function, and it does not allow or forbid.

     The dashed mark is listed because it appears in three panels — the tick
     above each bar, the route across the plane, and y = x — and the tick in
     particular is what makes the shrinkage readable, while being named nowhere
     else on the page. */
  legend: [
    { token: "empirical", label: "The fitted coefficients", mark: "bar" },
    { token: "theory", label: "Equal squared error", mark: "line" },
    { token: "highlight", label: "Equal penalty", mark: "line" },
    { token: "reference", label: "The unpenalised fit", mark: "line" },
  ],

  compute: computeAll,

  draw({ ctx, colors, w, h, params, state }) {
    const padL = PAD_L, padR = PAD_R;
    const inner = w - padL - padR;

    /* ---- panel 1: thirteen coefficients ---------------------------------- *
     * Abdomen is 10.27 against a median of 0.91, so twelve of the thirteen are
     * stubs on a shared axis. That is left alone deliberately: abdomen
     * circumference really does dominate body fat, and the thing this panel is
     * for survives any scale — how many bars are EXACTLY zero (2.3).          */
    /* THE EQUATION IS NO LONGER ON THE CANVAS — it is MathML above it, in a card.
       The canvas paid for that by getting 72px shorter rather than by giving the
       space to the panels: `rowTop` fell from 248 to 176. The panels got their
       space in a later change instead, by dropping the height cap — see the
       layout block at the top of this file. */
    renderEquation(state.w);

    /* THE BARS HAVE THE FULL WIDTH BACK. They gave up 174px of 470 to the
       correlation matrix while it was on the canvas; the matrix is a control and
       is now in the rail, so thirteen columns share the whole panel again. */
    const barW = inner;
    const barTop = BAR_TOP, barH = BAR_H;
    const lim = state.barLimit;
    const sy = (v) => barTop + barH / 2 - (v / lim) * (barH / 2);
    const band = barW / P;

    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (const t of [-lim / 2, lim / 2]) {
      ctx.beginPath();
      ctx.moveTo(padL, Math.round(sy(t)) + 0.5);
      ctx.lineTo(padL + barW, Math.round(sy(t)) + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const t of [-lim / 2, 0, lim / 2]) ctx.fillText(String(t), padL - 6, sy(t));

    /* The unpenalised fit as a tick per bar: the height every coefficient is
       shrinking away from, so the shrinkage is visible without a second panel. */
    ctx.strokeStyle = colors.reference;
    ctx.setLineDash([2, 2]);
    for (let j = 0; j < P; j += 1) {
      const cx = padL + band * (j + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - band * 0.34, Math.round(sy(OLS[j])) + 0.5);
      ctx.lineTo(cx + band * 0.34, Math.round(sy(OLS[j])) + 0.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (let j = 0; j < P; j += 1) {
      const cx = padL + band * (j + 0.5);
      const bw = Math.min(18, band - 5);
      const zero = Math.abs(state.w[j]) < 1e-9;
      ctx.fillStyle = colors.empirical;
      ctx.globalAlpha = zero ? 0.16 : 1;
      const y0 = sy(0), y1 = sy(state.w[j]);
      ctx.fillRect(cx - bw / 2, Math.min(y0, y1), bw, Math.max(1.5, Math.abs(y1 - y0)));
      ctx.globalAlpha = 1;
    }

    /* THE PAIR IS MARKED, NOT RECOLOURED. Filling these two bars with
       --c-highlight would give that token two meanings — "the pair on the
       plane" here and "what the penalty allows" there — and the legend can only
       carry one. A rule under the two bars and their labels says it instead. */
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2;
    for (const j of [state.ia, state.ib]) {
      const cx = padL + band * (j + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - band * 0.34, barTop + barH + 2.5);
      ctx.lineTo(cx + band * 0.34, barTop + barH + 2.5);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.axis;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(sy(0)) + 0.5);
    ctx.lineTo(padL + barW, Math.round(sy(0)) + 0.5);
    ctx.stroke();

    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let j = 0; j < P; j += 1) {
      const cx = padL + band * (j + 0.5);
      ctx.save();
      ctx.translate(cx + 3, barTop + barH + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = (j === state.ia || j === state.ib) ? colors.highlight : colors.ink3;
      ctx.fillText(COLS[j], 0, 0);
      ctx.restore();
    }
    ctx.restore();

    /* ---- panel 2: the coefficient plane ---------------------------------- */
    const rowTop = ROW_TOP;
    /* NO CAP. `height` above is what keeps this square — the panel is half the
       row and the canvas is however tall that makes it. */
    const side = panelSide(w);
    const planeW = side, dataW = side, rowH = side;

    /* ISOTROPIC, OR THE CIRCLE IS NOT A CIRCLE. One px-per-unit for both axes,
       and the domains follow from the panel's shape rather than the other way
       round — which is the whole reason the shapes can be read as shapes. */
    const px = Math.min(planeW, rowH) / state.span;
    const halfX = planeW / px / 2, halfY = rowH / px / 2;
    const plane = makePlot({
      ctx, colors,
      rect: { x: padL, y: rowTop, w: planeW, h: rowH },
      xDomain: [state.focus[0] - halfX, state.focus[0] + halfX],
      yDomain: [state.focus[1] - halfY, state.focus[1] + halfY],
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, rowTop, planeW, rowH);
    ctx.clip();

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(plane.sy(0)) + 0.5);
    ctx.lineTo(padL + planeW, Math.round(plane.sy(0)) + 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(Math.round(plane.sx(0)) + 0.5, rowTop);
    ctx.lineTo(Math.round(plane.sx(0)) + 0.5, rowTop + rowH);
    ctx.stroke();

    /* Contours of equal squared error. The quadratic form is [[1,r],[r,1]], so
       the axes are (1,1) and (1,-1) whatever r is and only the elongation
       carries information — see the header. */
    const e1 = Math.sqrt(1 + state.r), e2 = Math.sqrt(1 - state.r), q = Math.SQRT1_2;
    const ellipse = (radius) => {
      ctx.beginPath();
      for (let i = 0; i <= 150; i += 1) {
        const t = (i / 150) * Math.PI * 2;
        const u = (radius / e1) * Math.cos(t), v = (radius / e2) * Math.sin(t);
        const p1 = state.centre[0] + q * (u - v), p2 = state.centre[1] + q * (u + v);
        if (i === 0) ctx.moveTo(plane.sx(p1), plane.sy(p2));
        else ctx.lineTo(plane.sx(p1), plane.sy(p2));
      }
      ctx.closePath();
    };
    /* The radii are set from the SHORT axis, where a displacement of length L
       costs L*sqrt(1+r) — the expensive direction. Spacing them on the span
       alone put the first ring 9 units long before it was 2 units wide, so one
       contour filled the panel and the rest were off it. */
    const step = (state.span / 2) * Math.sqrt(1 + state.r) / 6;
    ctx.strokeStyle = colors.theory;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let k = 1; k <= 8; k += 1) { ellipse(k * step); ctx.stroke(); }
    ctx.globalAlpha = 1;

    /* The one contour the solution actually sits on, so the tangency has two
       lines meeting rather than a point floating among rings. */
    const dx = state.w[state.ia] - state.centre[0];
    const dy = state.w[state.ib] - state.centre[1];
    const at = Math.sqrt(dx * dx + 2 * state.r * dx * dy + dy * dy);
    if (at > 1e-6) {
      ctx.strokeStyle = colors.theory;
      ctx.lineWidth = 1.7;
      ellipse(at);
      ctx.stroke();
    }

    /* What the penalty allows: the set of coefficient pairs no more expensive
       than the one that was chosen. Solved along each ray, so a1 alone gives a
       true diamond, a2 alone a true circle, and both a rounded diamond. */
    if (state.a1 > 0 || state.a2 > 0) {
      const wa = state.w[state.ia], wb = state.w[state.ib];
      const budget = state.a1 * (Math.abs(wa) + Math.abs(wb))
        + (state.a2 / 2) * (wa * wa + wb * wb);
      ctx.beginPath();
      for (let i = 0; i <= 280; i += 1) {
        const t = (i / 280) * Math.PI * 2;
        const ux = Math.cos(t), uy = Math.sin(t);
        const quad = (state.a2 / 2) * (ux * ux + uy * uy);
        const linear = state.a1 * (Math.abs(ux) + Math.abs(uy));
        const s = quad < 1e-12
          ? budget / linear
          : (-linear + Math.sqrt(linear * linear + 4 * quad * budget)) / (2 * quad);
        if (i === 0) ctx.moveTo(plane.sx(s * ux), plane.sy(s * uy));
        else ctx.lineTo(plane.sx(s * ux), plane.sy(s * uy));
      }
      ctx.closePath();
      ctx.fillStyle = colors.highlight;
      ctx.globalAlpha = 0.1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }

    if (params.trail) {
      ctx.strokeStyle = colors.reference;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      state.trail.forEach((p, i) => {
        if (i === 0) ctx.moveTo(plane.sx(p[0]), plane.sy(p[1]));
        else ctx.lineTo(plane.sx(p[0]), plane.sy(p[1]));
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(plane.sx(state.unpenalised[0]), plane.sy(state.unpenalised[1]), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = colors.surface;
    ctx.fill();
    ctx.strokeStyle = colors.empirical;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(plane.sx(state.w[state.ia]), plane.sy(state.w[state.ib]), 5, 0, Math.PI * 2);
    ctx.fillStyle = colors.empirical;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.strokeRect(padL + 0.5, rowTop + 0.5, planeW - 1, rowH - 1);
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`coefficient on ${state.pair.a}`, padL + planeW / 2, rowTop + rowH + 8);
    ctx.translate(padL - 32, rowTop + rowH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "bottom";
    ctx.fillText(`coefficient on ${state.pair.b}`, 0, 0);
    ctx.restore();

    /* ---- panel 3: the predictions those coefficients make ---------------- *
     * Small and adjacent rather than a third full-width band. Its job is that
     * y-hat = Xw + b appears somewhere: the bars are the model, and this is what
     * the model says about the 252 men it was fitted to.                       */
    const dataX = padL + planeW + 44;
    /* THE FRAME HOLDS EVERY STATE, not just the opening one (2.5). It was 48,
       taken from the range of the outcome — but the x axis carries PREDICTIONS,
       which are not bounded by it: they reach 51.4 at α₁ = 0.3, so the same one
       man left the panel and came back as the reader dragged. Swept over every
       pair and both dial ladders: 4.1 to 51.4. */
    const dLo = 0, dHi = 56;
    const dsx = (v) => dataX + ((v - dLo) / (dHi - dLo)) * dataW;
    const dsy = (v) => rowTop + rowH - ((v - dLo) / (dHi - dLo)) * rowH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(dataX, rowTop, dataW, rowH);
    ctx.clip();
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(dsx(dLo), dsy(dLo));
    ctx.lineTo(dsx(dHi), dsy(dHi));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colors.empirical;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < N; i += 1) {
      ctx.beginPath();
      ctx.arc(dsx(state.predicted[i]), dsy(Y_RAW[i]), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1;
    ctx.strokeRect(dataX + 0.5, rowTop + 0.5, dataW - 1, rowH - 1);
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("predicted body fat %", dataX + dataW / 2, rowTop + rowH + 8);
    ctx.translate(dataX - 12, rowTop + rowH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "bottom";
    ctx.fillText("measured body fat %", 0, 0);
    ctx.restore();
  },

  readout: ({ state }) => [
    {
      label: "Coefficients not zero",
      value: `${state.kept} of ${P}`,
      /* Three states, not two: with both dials at zero nothing is shrinking at
         all, and a note claiming otherwise is a claim about a figure that has
         not been made yet (2.4). */
      note: state.a1 > 0 && state.a2 > 0 ? `at α₁ alone it would keep ${state.keptL1Only}`
        : state.a1 > 0 ? "only α₁ can reach exactly zero"
          : state.a2 > 0 ? "α₂ shrinks without reaching zero"
            : "no penalty — every measurement is in",
    },
    {
      label: "R² on these 252 men",
      value: fmt(state.r2, 3),
      note: state.a1 > 0 || state.a2 > 0
        ? `unpenalised, it is ${fmt(rSquared(OLS), 3)}`
        : "the most any linear fit can reach here",
    },
    {
      label: `${state.pair.a} against ${state.pair.b}`,
      value: `r = ${fmt(state.r, 3)}`,
      note: `contours ${fmt(elongation(state.r), 2)}:1`,
    },
  ],

  summary: ({ state }) =>
    `${state.cell}: ${state.kept} of ${P} coefficients are not zero, R² ${fmt(state.r2, 3)}. `
    + `The plane holds ${state.pair.a} against ${state.pair.b}, whose correlation of `
    + `${fmt(state.r, 3)} makes the equal-error contours ${fmt(elongation(state.r), 2)} times `
    + `longer than they are wide.`,
});
