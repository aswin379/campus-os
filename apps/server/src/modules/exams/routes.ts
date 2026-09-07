import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, authorizeAny } from '../../middleware/authorize.js';
import * as controller from './controller.js';

export const examsRouter = Router();
examsRouter.use(authenticate);

// Seeing current marks/results is a prerequisite for entering more marks or
// publishing, not just for viewing — gating these reads behind
// exams.view_results alone would let a staff member hold exams.enter_marks
// or exams.publish_results yet be unable to see the data they need to act.
const canReadExamData = authorizeAny('exams.view_results', 'exams.enter_marks', 'exams.publish_results');

examsRouter.post('/marks', authorize('exams.enter_marks'), asyncHandler(controller.enterMark));
examsRouter.get('/marks/:enrollmentId', canReadExamData, asyncHandler(controller.getMarks));
examsRouter.get('/results/:enrollmentId', canReadExamData, asyncHandler(controller.getResultPreview));
examsRouter.post('/results/:enrollmentId/publish', authorize('exams.publish_results'), asyncHandler(controller.publishResult));
examsRouter.get('/results/:enrollmentId/marksheet', authorize('exams.view_results'), asyncHandler(controller.getMarksheet));
examsRouter.get('/results/:enrollmentId/certificate', authorize('exams.view_results'), asyncHandler(controller.getCertificate));
