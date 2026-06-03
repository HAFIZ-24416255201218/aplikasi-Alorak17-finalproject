import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutAppPage } from './about-app.page';

describe('AboutAppPage', () => {
  let component: AboutAppPage;
  let fixture: ComponentFixture<AboutAppPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AboutAppPage ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AboutAppPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
