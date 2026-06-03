import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RegisterPage ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have invalid form when fields are empty', () => {
    expect(component.registerForm.valid).toBeFalsy();
  });

  it('should validate password match', () => {
    component.registerForm.patchValue({
      password: 'password123',
      confirmPassword: 'password456'
    });
    expect(component.registerForm.hasError('passwordMismatch')).toBeTruthy();
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword).toBeFalsy();
    component.togglePasswordVisibility('password');
    expect(component.showPassword).toBeTruthy();
  });

  it('should toggle confirm password visibility', () => {
    expect(component.showConfirmPassword).toBeFalsy();
    component.togglePasswordVisibility('confirmPassword');
    expect(component.showConfirmPassword).toBeTruthy();
  });
});
