package kr.dropzone.squad;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
public class ArenaActivity extends Activity {
    private WebView arena;
    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        immersive();
        arena = new WebView(this);
        arena.setBackgroundColor(0xff111a20);
        arena.getSettings().setJavaScriptEnabled(true);
        arena.getSettings().setAllowContentAccess(false);
        arena.getSettings().setBlockNetworkLoads(true);
        arena.setOnLongClickListener(v -> true);
        setContentView(arena);
        arena.loadUrl("file:///android_asset/index.html");
    }
    @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); if (focused) immersive(); }
    @Override public void onPause() { arena.evaluateJavascript("if(typeof pause==='function')pause()", null); arena.onPause(); super.onPause(); }
    @Override public void onResume() { super.onResume(); if(arena!=null)arena.onResume(); }
    @Override public void onBackPressed() {
        arena.evaluateJavascript("typeof mode==='undefined'||mode==='home'", value -> {
            if ("true".equals(value)) finish();
            else arena.evaluateJavascript("window.gameBack&&window.gameBack()",null);
        });
    }
}
