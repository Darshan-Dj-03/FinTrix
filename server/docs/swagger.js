const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const specification = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Fintrix Backend API",
      version: "1.0.0",
      description: "OpenAPI documentation for the Fintrix hostel mess billing backend.",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/health": { get: { summary: "Health check", security: [], responses: { 200: { description: "Healthy" } } } },
      "/auth/login": { post: { summary: "Authenticate user", security: [], responses: { 200: { description: "Authenticated" } } } },
      "/auth/change-password": { post: { summary: "Change password", responses: { 200: { description: "Password changed" } } } },
      "/admin/create-user": { post: { summary: "Create caretaker, warden, or dean", responses: { 201: { description: "User created" } } } },
      "/hostel/create": { post: { summary: "Create hostel", responses: { 201: { description: "Hostel created" } } } },
      "/hostel/all": { get: { summary: "List hostels", responses: { 200: { description: "Hostels fetched" } } } },
      "/student/add": { post: { summary: "Add student", responses: { 201: { description: "Student created" } } } },
      "/student/all": { get: { summary: "List students", responses: { 200: { description: "Students fetched" } } } },
      "/student/update/{id}": {
        patch: {
          summary: "Update student",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Student updated" } },
        },
      },
      "/expense/create": { post: { summary: "Create expense", responses: { 201: { description: "Expense created" } } } },
      "/expense/{month}": {
        get: {
          summary: "Get expense by month",
          parameters: [{ in: "path", name: "month", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Expense fetched" } },
        },
      },
      "/expense/{id}": {
        patch: {
          summary: "Update expense",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Expense updated" } },
        },
        delete: {
          summary: "Delete expense",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Expense deleted" } },
        },
      },
      "/bill/generate/{month}": {
        post: {
          summary: "Generate bills",
          parameters: [{ in: "path", name: "month", required: true, schema: { type: "string" } }],
          responses: { 201: { description: "Bills generated" } },
        },
      },
      "/bill/all/{month}": {
        get: {
          summary: "Get all bills for a month",
          parameters: [{ in: "path", name: "month", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Bills fetched" } },
        },
      },
      "/bill/student/{studentId}/{month}": {
        get: {
          summary: "Get a student bill",
          parameters: [
            { in: "path", name: "studentId", required: true, schema: { type: "string" } },
            { in: "path", name: "month", required: true, schema: { type: "string" } },
          ],
          responses: { 200: { description: "Bill fetched" } },
        },
      },
      "/payment": {
        post: { summary: "Record payment", responses: { 201: { description: "Payment recorded" } } },
        get: { summary: "List payment history", responses: { 200: { description: "Payments fetched" } } },
      },
      "/payment/{paymentId}": {
        get: {
          summary: "Get a payment by id",
          parameters: [{ in: "path", name: "paymentId", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Payment fetched" } },
        },
      },
      "/payment/bill/{billId}": {
        get: {
          summary: "Get payment history by bill",
          parameters: [{ in: "path", name: "billId", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Payments fetched" } },
        },
      },
      "/report/generate/{month}": { post: { summary: "Generate report snapshot", responses: { 201: { description: "Report generated" } } } },
      "/report/submit/{month}": { put: { summary: "Submit report", responses: { 200: { description: "Report submitted" } } } },
      "/report/warden-approve/{month}": { put: { summary: "Warden approve report", responses: { 200: { description: "Warden approval saved" } } } },
      "/report/dean-approve/{month}": { put: { summary: "Dean approve report", responses: { 200: { description: "Dean approval saved" } } } },
      "/report/status/{month}": { get: { summary: "Get report status", responses: { 200: { description: "Status fetched" } } } },
      "/report/full/{month}": { get: { summary: "Get full report snapshot", responses: { 200: { description: "Report fetched" } } } },
      "/ebl/student": { get: { summary: "Get student EBL reimbursement status", responses: { 200: { description: "EBL status fetched" } } } },
      "/ebl/periods": {
        get: { summary: "List EBL reimbursement periods", responses: { 200: { description: "EBL periods fetched" } } },
        post: { summary: "Create EBL reimbursement period", responses: { 201: { description: "EBL period created" } } },
      },
      "/ebl/periods/{id}": {
        put: {
          summary: "Update EBL reimbursement period",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "EBL period updated" } },
        },
      },
      "/ebl/periods/{id}/verify": {
        put: {
          summary: "Verify EBL reimbursement period",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "EBL period verified" } },
        },
      },
      "/ebl/periods/{id}/approve": {
        put: {
          summary: "Approve EBL reimbursement period by warden",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "EBL period approved" } },
        },
      },
      "/charges/add": { post: { summary: "Create charge", responses: { 201: { description: "Charge created" } } } },
      "/charges/{month}": { get: { summary: "List charges", responses: { 200: { description: "Charges fetched" } } } },
    },
  },
  apis: [],
});

const registerSwagger = (app) => {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(specification));
};

module.exports = registerSwagger;
