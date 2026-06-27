package com.alorack17.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long SPLASH_MIN_DURATION_MS = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        long splashStartTime = System.currentTimeMillis();
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() ->
            System.currentTimeMillis() - splashStartTime < SPLASH_MIN_DURATION_MS
        );
        super.onCreate(savedInstanceState);
    }
}
