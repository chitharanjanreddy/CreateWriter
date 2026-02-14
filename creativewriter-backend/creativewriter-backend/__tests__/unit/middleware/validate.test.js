const { createMockReq, createMockRes, createMockNext } = require('../../helpers/mockExpress');

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn()
}));

const { validationResult } = require('express-validator');
const validate = require('../../../src/middleware/validate');

describe('validate middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() when there are no validation errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    validate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 with extracted errors when validation fails', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'email', msg: 'Email is required' },
        { path: 'password', msg: 'Password is required' }
      ]
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    validate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is required' }
      ]
    });
  });

  it('should handle a single validation error', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'name', msg: 'Name cannot exceed 100 characters' }
      ]
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.errors).toHaveLength(1);
    expect(response.errors[0].field).toBe('name');
  });

  it('should map err.path to field in extracted errors', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'body.email', msg: 'Invalid email format' }
      ]
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    validate(req, res, next);

    const response = res.json.mock.calls[0][0];
    expect(response.errors[0].field).toBe('body.email');
    expect(response.errors[0].message).toBe('Invalid email format');
  });
});
