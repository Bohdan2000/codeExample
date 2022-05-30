import { INestApplication } from '@nestjs/common';
import { advanceTo } from 'jest-date-mock';
import * as request from 'supertest';
import { getConnection } from 'typeorm';
import { Role } from '../../domain/enums/role.enum';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { createDistrictAdmin, createSA } from '../../infrastructure/db/seeding/seeds/default.seed';
import { buildCreateDistrictModel } from '../data-builders/district.data-builder';
import {
  buildCreateUserParams,
  buildResetPasswordParams,
  buildSetPasswordParams,
} from '../data-builders/mock.data-builder';
import { ADMIN_DISTRICT, ADMIN_TOKEN } from '../data-builders/token.data-builder';
import {
  buildCreateUserModel,
  buildDistrictAdministratorReadModel,
  buildTeacherReadModel,
  buildUserReadModel,
} from '../data-builders/user.data-builder';
import { afterTests, createBeforeTests, deleteMetadata } from '../helpers/data-cleaner.helper';
import { cleanDb, updateUserStatusToActive } from '../helpers/postgres.helper';
import { mockAdminCreateUser, mockAdminSetUserPassword, mockConfirmForgotPassword } from '../__mocks__/aws-sdk';

describe('user', () => {
  let app: INestApplication;
  let refModule;
  const districtId = 'eeb4df90-9ef5-11ec-ba0f-7f73d49dcc8d';

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanDb(getConnection());
    await createSA();
    await createDistrictAdmin();
    advanceTo(new Date(2021, 5, 19, 0, 0, 0));
  });

  beforeAll(async () => {
    delete process.env.CLIENT_ID;
    delete process.env.POOL_ID;

    const { application, moduleRef } = await createBeforeTests(app);
    app = application;
    refModule = moduleRef;
  });

  it('should create user', async () => {
    const userModel = buildCreateUserModel();
    const { text: userId } = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(userModel)
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    expect(deleteMetadata(body)).toEqual(buildUserReadModel({ id: userId, userFriendlyId: body.userFriendlyId }));
    expect(mockAdminCreateUser).toHaveBeenCalledWith(
      buildCreateUserParams({
        districtId,
        userId,
        firstName: userModel.name.first,
        lastName: userModel.name.last,
        ...userModel,
      }),
    );
  });

  it('should create school administrator and get all', async () => {
    const userModel = buildCreateUserModel({ role: Role.DistrictAdministrator });
    const { text: userId } = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(userModel)
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .get(`/users?roles=${Role.DistrictAdministrator}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    expect(deleteMetadata(body.items)).toEqual([
      buildDistrictAdministratorReadModel({
        id: '6d6af290-9efe-11ec-ae13-bd434ea3f9da',
        userFriendlyId: 2,
        email: 'yurii.kniazyk@euristiq.com',
        name: {
          first: 'Yurii',
          last: 'Kniazyk',
        },
        status: UserStatus.Active,
      }),
      buildDistrictAdministratorReadModel({ id: userId, userFriendlyId: 3 }),
    ]);
  });

  it('should create user and set password', async () => {
    const userModel = buildCreateUserModel();
    const { text: userId } = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(userModel)
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);

    expect(deleteMetadata(body)).toEqual(buildUserReadModel({ id: userId, userFriendlyId: body.userFriendlyId }));
    expect(mockAdminCreateUser).toHaveBeenCalledWith(
      buildCreateUserParams({
        districtId,
        userId,
        firstName: userModel.name.first,
        lastName: userModel.name.last,
        ...userModel,
      }),
    );

    await request(app.getHttpServer()).post(`/set-password/${userId}`).send({ password: '12345678!Qa' }).expect(201);
    expect(mockAdminSetUserPassword).toHaveBeenCalledWith(buildSetPasswordParams({ password: '12345678!Qa' }));
  });

  it('reset password', async () => {
    await request(app.getHttpServer())
      .post(`/reset-password`)
      .send({ password: '12345678Qq?', code: '123456', username: '1:default' })
      .expect(201);
    expect(mockConfirmForgotPassword).toHaveBeenCalledWith(
      buildResetPasswordParams({
        password: '12345678Qq?',
        confirmationCode: '123456',
      }),
    );
  });

  it('should create ClassTeacher and get by districtId', async () => {
    const userModel = buildCreateUserModel({ role: Role.ClassTeacher });
    const { text: userId } = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(userModel)
      .expect(201);
    await updateUserStatusToActive(userId, getConnection());
    const { body } = await request(app.getHttpServer())
      .get(`/users?roles=${Role.ClassTeacher}&districtId=eeb4df90-9ef5-11ec-ba0f-7f73d49dcc8d`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(deleteMetadata(body.items)).toEqual([
      buildTeacherReadModel({ id: userId, status: UserStatus.Active, userFriendlyId: 3 }),
    ]);
  });

  it('should change districtId for SA', async () => {
    const { text: districtId } = await request(app.getHttpServer())
      .post('/districts')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(buildCreateDistrictModel())
      .expect(201);

    await request(app.getHttpServer())
      .post(`/users/select-district`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ districtId })
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .get(`/users/e8f374c0-9bc3-11ec-8cb4-d18c12dd465e`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(body.districtId).toBe(districtId);
  });

  it('shouldn`t create SA', async () => {
    const userModel = buildCreateUserModel({ role: Role.SA });
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ADMIN_DISTRICT}`)
      .send(userModel)
      .expect(403);
  });

  it('should create school administrator, sort by last name and get all', async () => {
    const districtAdmin = buildCreateUserModel({
      role: Role.DistrictAdministrator,
      name: { first: 'A', last: 'B' },
    });
    const { text: id } = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(districtAdmin)
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .get(`/users?roles=${Role.DistrictAdministrator}&sort=user.name.last,ASC`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    expect(body.items[0].id).toEqual(id);
  });

  afterEach(async () => {
    await cleanDb(getConnection());
  });

  afterAll(async () => {
    await afterTests(app);
  });
});
