package com.ossflix.tv

import android.app.Activity
import android.view.KeyEvent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments

/**
 * Forwards TV remote / D-pad / media keys to JS as `remoteKey` device events
 * (see src/native/remoteKeys.ts). It only observes: callers still pass the event
 * on, so Android's normal D-pad focus navigation keeps working.
 */
object RemoteKeyEmitter {
  const val EVENT_NAME = "remoteKey"

  private val keyNames =
      mapOf(
          KeyEvent.KEYCODE_DPAD_UP to "up",
          KeyEvent.KEYCODE_DPAD_DOWN to "down",
          KeyEvent.KEYCODE_DPAD_LEFT to "left",
          KeyEvent.KEYCODE_DPAD_RIGHT to "right",
          KeyEvent.KEYCODE_DPAD_CENTER to "select",
          KeyEvent.KEYCODE_ENTER to "select",
          KeyEvent.KEYCODE_NUMPAD_ENTER to "select",
          KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE to "playPause",
          KeyEvent.KEYCODE_MEDIA_PLAY to "play",
          KeyEvent.KEYCODE_MEDIA_PAUSE to "pause",
          KeyEvent.KEYCODE_MEDIA_FAST_FORWARD to "fastForward",
          KeyEvent.KEYCODE_MEDIA_REWIND to "rewind",
          KeyEvent.KEYCODE_MENU to "menu",
      )

  fun emit(activity: Activity, event: KeyEvent) {
    if (event.action != KeyEvent.ACTION_DOWN) return
    val name = keyNames[event.keyCode] ?: return
    val context = (activity.application as? ReactApplication)?.reactHost?.currentReactContext ?: return
    val params =
        Arguments.createMap().apply {
          putString("key", name)
          putInt("repeatCount", event.repeatCount)
        }
    context.emitDeviceEvent(EVENT_NAME, params)
  }
}
